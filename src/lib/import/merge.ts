import { STAT_KEYS } from '../domain/statDefinitions.ts';
import type {
	Candidate,
	MergedImport,
	MergedStat,
	NameCandidate,
	ScreenshotAnalysis,
	StatStatus,
	ValidationIssue
} from './types.ts';

/** A value read by at least this many independent observations is considered consistent. */
const AGREEMENT_VOTES = 2;
/** A single observation at or above this confidence is accepted without confirmation. */
const CONFIDENT = 85;
/** A screenshot with fewer recognized rows than this probably is not the career screen. */
export const MIN_ROWS_PER_SCREENSHOT = 3;

function groupCandidates(entries: { value: number; confidence: number }[]): Candidate[] {
	const byValue = new Map<number, Candidate>();
	for (const entry of entries) {
		const existing = byValue.get(entry.value);
		if (existing) {
			existing.votes++;
			existing.confidence = Math.max(existing.confidence, entry.confidence);
		} else {
			byValue.set(entry.value, { value: entry.value, votes: 1, confidence: entry.confidence });
		}
	}
	return [...byValue.values()].sort((a, b) => b.votes - a.votes || b.confidence - a.confidence);
}

function statusFor(candidates: Candidate[]): StatStatus {
	if (candidates.length === 0) return 'missing';
	if (candidates.length > 1) return 'conflict';
	const [only] = candidates;
	return only.votes >= AGREEMENT_VOTES || only.confidence >= CONFIDENT ? 'ok' : 'uncertain';
}

/**
 * Combines observations from all screenshots and passes. Equal values reinforce each other;
 * different values for the same statistic become a conflict instead of being resolved silently.
 */
export function mergeAnalyses(analyses: ScreenshotAnalysis[]): MergedImport {
	const all = analyses.flatMap((a) => a.observations);

	const stats: MergedStat[] = STAT_KEYS.map((key) => {
		const observations = all.filter((o) => o.key === key);
		const candidates = groupCandidates(observations);
		const status = statusFor(candidates);
		return {
			key,
			status,
			value: status === 'ok' || status === 'uncertain' ? candidates[0].value : null,
			candidates,
			screenshots: [...new Set(observations.map((o) => o.screenshot))].sort()
		};
	});

	const names = new Map<string, NameCandidate>();
	for (const name of analyses.flatMap((a) => a.names)) {
		const existing = names.get(name.text);
		if (existing) {
			existing.votes++;
			existing.confidence = Math.max(existing.confidence, name.confidence);
		} else {
			names.set(name.text, { text: name.text, votes: 1, confidence: name.confidence });
		}
	}

	return {
		stats,
		names: [...names.values()].sort((a, b) => b.votes - a.votes || b.confidence - a.confidence),
		matchedRows: analyses.map((a) => a.matchedRows)
	};
}

/** Warnings about the screenshots themselves rather than about individual values. */
export function checkScreenshots(analyses: ScreenshotAnalysis[]): ValidationIssue[] {
	const issues: ValidationIssue[] = [];

	analyses.forEach((analysis, index) => {
		if (analysis.matchedRows < MIN_ROWS_PER_SCREENSHOT) {
			issues.push({
				code: 'tooFewRows',
				severity: 'warning',
				keys: [],
				params: { screenshot: index + 1 }
			});
		}
	});

	if (analyses.length === 2) {
		const [a, b] = analyses.map((analysis) => new Set(analysis.observations.map((o) => o.key)));
		const subset = (x: Set<string>, y: Set<string>) => [...x].every((key) => y.has(key));
		if (a.size > 0 && b.size > 0 && (subset(a, b) || subset(b, a))) {
			issues.push({ code: 'screenshotAddedNothing', severity: 'warning', keys: [], params: {} });
		}
	}
	return issues;
}
