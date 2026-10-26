import { getDefinition, type StatKey } from '../domain/statDefinitions.ts';
import { formatDateTime } from '../format.ts';
import type { CapturedAtSource, StatsSnapshot } from '../domain/stats.ts';
import { previewInsertion } from '../analytics/history.ts';
import { PASSES_PER_SCREENSHOT, analyzeScreenshot } from '../import/analyze.ts';
import {
	FUTURE_TOLERANCE_MS,
	currentDate,
	fileDate,
	defaultCaptureDate,
	detectDateSource,
	parseLocalInput,
	toLocalInputValue
} from '../import/captureDate.ts';
import { parseEditedValue } from '../import/edit.ts';
import { isAcceptedImage, readPixels } from '../import/image.ts';
import { MIN_ROWS_PER_SCREENSHOT, checkScreenshots, mergeAnalyses } from '../import/merge.ts';
import {
	buildPlayerStats,
	resolveStats,
	toValues,
	validateValues,
	type Decisions
} from '../import/resolve.ts';
import type { MergedImport, ScreenshotAnalysis, ValidationIssue } from '../import/types.ts';
import { career } from './career.svelte.ts';

export const SLOT_COUNT = 2;

export type Phase = 'idle' | 'scanning' | 'review' | 'failed';
export type Failure = 'engine' | 'notCareerScreen' | 'unreadable';
export type SaveState = 'idle' | 'saving' | 'failed';

export interface Slot {
	file: File | null;
	previewUrl: string | null;
}

/** Share of the progress bar used for starting the OCR engine. */
const ENGINE_SHARE = 0.1;

function counterLabels(keys: StatKey[]): string {
	return keys.map((key) => getDefinition(key).label).join(', ');
}

function emptySlot(): Slot {
	return { file: null, previewUrl: null };
}

/**
 * State of one screenshot import: choosing files, scanning, reviewing the recognized values
 * and saving. Nothing is written to storage until `save()` is called after the user confirms.
 */
export class ImportSession {
	slots = $state<Slot[]>(Array.from({ length: SLOT_COUNT }, emptySlot));
	rejectedFile = $state(false);

	phase = $state<Phase>('idle');
	failure = $state<Failure | null>(null);
	progress = $state(0);
	/** Screenshot being scanned (0-based), or -1 while the engine starts. */
	scanning = $state(-1);

	merged = $state.raw<MergedImport | null>(null);
	screenshotIssues = $state.raw<ValidationIssue[]>([]);
	decisions = $state<Decisions['values']>({});
	confirmed = $state<StatKey[]>([]);
	displayName = $state('');
	statsDate = $state('');
	suggestedSource = $state<CapturedAtSource>('import-time');
	markReset = $state(false);
	saveState = $state<SaveState>('idle');

	resolved = $derived(
		this.merged
			? resolveStats(this.merged.stats, { values: this.decisions, confirmed: this.confirmed })
			: []
	);
	values = $derived(toValues(this.resolved));
	blocking = $derived(this.resolved.filter((stat) => stat.blocking));
	stats = $derived(buildPlayerStats(this.values));

	fileDates = $derived(this.slots.map((slot) => fileDate(slot.file)));
	datesDiffer = $derived(
		this.phase === 'review' && defaultCaptureDate(this.fileDates, currentDate()).differ
	);
	capturedAt = $derived(parseLocalInput(this.statsDate));

	candidate = $derived<StatsSnapshot | null>(
		this.stats && this.capturedAt
			? {
					id: 'candidate',
					capturedAt: this.capturedAt.toISOString(),
					importedAt: currentDate().toISOString(),
					capturedAtSource: 'user',
					source: 'screenshot',
					stats: this.stats
				}
			: null
	);
	insertion = $derived(this.candidate ? previewInsertion(career.snapshots, this.candidate) : null);
	possibleReset = $derived(this.insertion?.before?.status === 'anomaly');
	/** The reset mark only counts while there is something to mark. */
	resetConfirmed = $derived(this.markReset && this.possibleReset);

	dateIssues = $derived.by<ValidationIssue[]>(() => {
		const issues: ValidationIssue[] = [];
		if (this.phase !== 'review') return issues;
		if (!this.capturedAt) {
			issues.push({ code: 'invalidDate', severity: 'error', keys: [], params: {} });
		} else if (this.capturedAt.getTime() > Date.now() + FUTURE_TOLERANCE_MS) {
			issues.push({ code: 'dateInFuture', severity: 'error', keys: [], params: {} });
		}
		if (this.datesDiffer) {
			issues.push({ code: 'datesDiffer', severity: 'warning', keys: [], params: {} });
		}
		return issues;
	});

	historyIssues = $derived.by<ValidationIssue[]>(() => {
		const issues: ValidationIssue[] = [];
		const { before, after } = this.insertion ?? { before: null, after: null };
		if (before?.status === 'anomaly' && !this.markReset) {
			issues.push({
				code: 'possibleReset',
				severity: 'error',
				keys: before.decreased,
				params: {
					date: formatDateTime(before.from.capturedAt),
					counters: counterLabels(before.decreased)
				}
			});
		}
		if (after?.status === 'anomaly') {
			issues.push({
				code: 'nextSnapshotAnomaly',
				severity: 'warning',
				keys: after.decreased,
				params: {
					date: formatDateTime(after.to.capturedAt),
					counters: counterLabels(after.decreased)
				}
			});
		}
		return issues;
	});

	issues = $derived([
		...this.screenshotIssues,
		...this.dateIssues,
		...validateValues(this.values),
		...this.historyIssues
	]);

	duplicateOf = $derived(
		this.stats && this.capturedAt
			? career.findDuplicate(this.stats, this.capturedAt.toISOString())
			: null
	);
	isDuplicate = $derived(this.duplicateOf !== null);
	canAnalyze = $derived(
		this.slots.every((slot) => slot.file !== null) && this.phase !== 'scanning'
	);
	canSave = $derived(
		this.phase === 'review' &&
			this.stats !== null &&
			this.blocking.length === 0 &&
			!this.issues.some((issue) => issue.severity === 'error') &&
			this.displayName.trim() !== '' &&
			!this.isDuplicate &&
			this.saveState !== 'saving'
	);

	addFiles(files: File[], start = 0): void {
		this.rejectedFile = false;
		let index = start;
		for (const file of files) {
			if (!isAcceptedImage(file)) {
				this.rejectedFile = true;
				continue;
			}
			if (index >= SLOT_COUNT) break;
			this.setSlot(index++, file);
		}
	}

	addPasted(files: File[]): void {
		const free = this.slots.findIndex((slot) => slot.file === null);
		this.addFiles(files, free === -1 ? 0 : free);
	}

	clearSlot(index: number): void {
		this.setSlot(index, null);
	}

	private setSlot(index: number, file: File | null): void {
		const previous = this.slots[index].previewUrl;
		if (previous) URL.revokeObjectURL(previous);
		this.slots[index] = file ? { file, previewUrl: URL.createObjectURL(file) } : emptySlot();
		// New input invalidates any earlier results.
		if (this.phase !== 'scanning') this.discardResults();
	}

	private discardResults(): void {
		this.phase = 'idle';
		this.failure = null;
		this.merged = null;
		this.screenshotIssues = [];
		this.decisions = {};
		this.confirmed = [];
		this.markReset = false;
		this.statsDate = '';
		this.saveState = 'idle';
		this.progress = 0;
	}

	async analyze(): Promise<void> {
		const files = this.slots.map((slot) => slot.file);
		if (this.phase === 'scanning' || files.some((file) => file === null)) return;

		this.discardResults();
		this.phase = 'scanning';
		this.scanning = -1;

		let engine: { terminate(): Promise<void> } | null = null;
		try {
			const { createBrowserEngine } = await import('../import/ocr.ts');
			const browserEngine = await createBrowserEngine();
			engine = browserEngine;
			this.progress = ENGINE_SHARE;

			const analyses: ScreenshotAnalysis[] = [];
			for (const [index, file] of files.entries()) {
				this.scanning = index;
				const image = await readPixels(file as File).catch(() => null);
				if (!image) {
					this.fail('unreadable');
					return;
				}
				const analysis = await analyzeScreenshot(image, index, browserEngine, {
					onStep: (done) => {
						const share =
							(index * PASSES_PER_SCREENSHOT + done) / (SLOT_COUNT * PASSES_PER_SCREENSHOT);
						this.progress = ENGINE_SHARE + (1 - ENGINE_SHARE) * share;
					}
				});
				analyses.push(analysis);
			}

			if (analyses.every((a) => a.matchedRows < MIN_ROWS_PER_SCREENSHOT)) {
				this.fail('notCareerScreen');
				return;
			}

			const merged = mergeAnalyses(analyses);
			this.merged = merged;
			this.screenshotIssues = checkScreenshots(analyses);
			this.displayName = this.pickName(merged);
			const suggested = defaultCaptureDate(this.fileDates, currentDate());
			this.suggestedSource = suggested.source;
			this.statsDate = toLocalInputValue(suggested.date);
			this.progress = 1;
			this.phase = 'review';
		} catch {
			this.fail('engine');
		} finally {
			await engine?.terminate().catch(() => undefined);
		}
	}

	/** Uses the recognized name when it is trustworthy, otherwise the saved profile name. */
	private pickName(merged: MergedImport): string {
		const [best] = merged.names;
		const saved = career.profile?.displayName ?? '';
		if (best && (best.votes >= 2 || best.confidence >= 80)) return best.text;
		return saved || (best?.text ?? '');
	}

	private fail(failure: Failure): void {
		this.failure = failure;
		this.phase = 'failed';
	}

	choose(key: StatKey, value: number): void {
		this.decisions[key] = { value, origin: 'chosen' };
	}

	confirm(key: StatKey): void {
		if (!this.confirmed.includes(key)) this.confirmed.push(key);
	}

	edit(key: StatKey, text: string): boolean {
		const value = parseEditedValue(key, text);
		if (value === null) return false;
		this.decisions[key] = { value, origin: 'edited' };
		return true;
	}

	undo(key: StatKey): void {
		delete this.decisions[key];
		this.confirmed = this.confirmed.filter((k) => k !== key);
	}

	useFileDate(index: number): void {
		const date = this.fileDates[index];
		if (date) this.statsDate = toLocalInputValue(date);
	}

	async save(): Promise<boolean> {
		if (!this.canSave || !this.stats || !this.capturedAt) return false;
		this.saveState = 'saving';
		try {
			const outcome = await career.saveImport({
				displayName: this.displayName.trim(),
				stats: this.stats,
				capturedAt: this.capturedAt.toISOString(),
				capturedAtSource: detectDateSource(this.capturedAt, this.fileDates, this.suggestedSource),
				resetConfirmed: this.resetConfirmed
			});
			this.saveState = 'idle';
			return outcome === 'saved';
		} catch {
			this.saveState = 'failed';
			return false;
		}
	}

	reset(): void {
		for (let i = 0; i < SLOT_COUNT; i++) this.setSlot(i, null);
		this.discardResults();
	}

	destroy(): void {
		for (const slot of this.slots) if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
	}
}
