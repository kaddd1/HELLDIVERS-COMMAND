import { validateValues } from '../import/resolve.ts';
import { isExtraStatKey, STAT_KEYS, type ExtraStatKey } from './statDefinitions.ts';
import {
	statsEqual,
	toStatValues,
	type CapturedAtSource,
	type PlayerProfile,
	type PlayerStats,
	type StatsSnapshot
} from './stats.ts';

export const BACKUP_APP = 'helldivers-command';
export const BACKUP_VERSION = 1;

export interface BackupFile {
	app: typeof BACKUP_APP;
	schemaVersion: number;
	exportedAt: string;
	profile: { displayName: string; createdAt: string } | null;
	snapshots: StatsSnapshot[];
}

export function createBackup(
	profile: PlayerProfile | null,
	snapshots: readonly StatsSnapshot[],
	exportedAt = new Date().toISOString()
): BackupFile {
	return {
		app: BACKUP_APP,
		schemaVersion: BACKUP_VERSION,
		exportedAt,
		profile: profile ? { displayName: profile.displayName, createdAt: profile.createdAt } : null,
		snapshots: [...snapshots]
	};
}

export type BackupErrorCode = 'notJson' | 'notBackup' | 'newerVersion' | 'noSnapshots';

export type InvalidReason =
	| { code: 'notObject' }
	| { code: 'badId' }
	| { code: 'badDate' }
	| { code: 'badStats' }
	| { code: 'badValue'; field: string }
	| { code: 'inconsistent'; issue: string };

export interface InvalidEntry {
	position: number;
	reason: InvalidReason;
}

export type ParsedBackup =
	| { ok: false; error: BackupErrorCode }
	| {
			ok: true;
			profile: BackupFile['profile'];
			snapshots: StatsSnapshot[];
			invalid: InvalidEntry[];
	  };

const MAX_COUNT = 1_000_000_000_000;
const SOURCES = ['manual', 'screenshot'] as const;
const DATE_SOURCES: readonly CapturedAtSource[] = ['file', 'user', 'import-time'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
	return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_COUNT;
}

function toIso(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type Parsed<T> = { ok: true; value: T } | { ok: false; reason: InvalidReason };

function parseStats(raw: unknown): Parsed<PlayerStats> {
	if (!isRecord(raw)) return { ok: false, reason: { code: 'badStats' } };

	const required = ['level', 'kills', 'deaths', 'missionsPlayed', 'missionsCompleted'] as const;
	for (const field of required) {
		if (!isCount(raw[field])) return { ok: false, reason: { code: 'badValue', field } };
	}
	const optional = ['shotsFired', 'shotsHit', 'timePlayedSeconds'] as const;
	for (const field of optional) {
		const value = raw[field];
		if (value !== null && value !== undefined && !isCount(value)) {
			return { ok: false, reason: { code: 'badValue', field } };
		}
	}
	if (raw.rankTitle !== null && raw.rankTitle !== undefined && typeof raw.rankTitle !== 'string') {
		return { ok: false, reason: { code: 'badValue', field: 'rankTitle' } };
	}

	const extra: Partial<Record<ExtraStatKey, number>> = {};
	if (raw.extra !== undefined && !isRecord(raw.extra)) {
		return { ok: false, reason: { code: 'badValue', field: 'extra' } };
	}
	for (const [key, value] of Object.entries(raw.extra ?? {})) {
		// Unknown keys (from a newer version of the app) are ignored rather than rejected.
		if (!(STAT_KEYS as readonly string[]).includes(key) || !isExtraStatKey(key as never)) continue;
		if (!isCount(value)) return { ok: false, reason: { code: 'badValue', field: key } };
		extra[key as ExtraStatKey] = value;
	}

	const stats: PlayerStats = {
		level: raw.level as number,
		rankTitle: (raw.rankTitle as string | null | undefined) ?? null,
		kills: raw.kills as number,
		deaths: raw.deaths as number,
		missionsPlayed: raw.missionsPlayed as number,
		missionsCompleted: raw.missionsCompleted as number,
		shotsFired: (raw.shotsFired as number | null | undefined) ?? null,
		shotsHit: (raw.shotsHit as number | null | undefined) ?? null,
		timePlayedSeconds: (raw.timePlayedSeconds as number | null | undefined) ?? null,
		extra
	};

	const problem = validateValues(toStatValues(stats)).find((issue) => issue.severity === 'error');
	if (problem) return { ok: false, reason: { code: 'inconsistent', issue: problem.code } };
	return { ok: true, value: stats };
}

function parseSnapshot(raw: unknown): Parsed<StatsSnapshot> {
	if (!isRecord(raw)) return { ok: false, reason: { code: 'notObject' } };
	if (typeof raw.id !== 'string' || raw.id.trim() === '' || raw.id.length > 100) {
		return { ok: false, reason: { code: 'badId' } };
	}
	const capturedAt = toIso(raw.capturedAt);
	if (!capturedAt) return { ok: false, reason: { code: 'badDate' } };
	const importedAt = raw.importedAt === undefined ? capturedAt : toIso(raw.importedAt);
	if (!importedAt) return { ok: false, reason: { code: 'badDate' } };

	const stats = parseStats(raw.stats);
	if (!stats.ok) return stats;

	const source = (SOURCES as readonly unknown[]).includes(raw.source)
		? (raw.source as StatsSnapshot['source'])
		: 'manual';
	const capturedAtSource = DATE_SOURCES.includes(raw.capturedAtSource as CapturedAtSource)
		? (raw.capturedAtSource as CapturedAtSource)
		: 'import-time';

	const snapshot: StatsSnapshot = {
		id: raw.id,
		capturedAt,
		importedAt,
		capturedAtSource,
		source,
		stats: stats.value
	};
	if (raw.resetConfirmed === true) snapshot.resetConfirmed = true;
	if (raw.excluded === true) snapshot.excluded = true;
	return { ok: true, value: snapshot };
}

/** Validates a backup file's text. Invalid snapshots are reported, never silently repaired. */
export function parseBackup(text: string): ParsedBackup {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return { ok: false, error: 'notJson' };
	}
	if (!isRecord(data) || data.app !== BACKUP_APP || !Array.isArray(data.snapshots)) {
		return { ok: false, error: 'notBackup' };
	}
	if (typeof data.schemaVersion !== 'number' || data.schemaVersion > BACKUP_VERSION) {
		return { ok: false, error: 'newerVersion' };
	}

	const snapshots: StatsSnapshot[] = [];
	const invalid: InvalidEntry[] = [];
	data.snapshots.forEach((raw, index) => {
		const parsed = parseSnapshot(raw);
		if (parsed.ok) snapshots.push(parsed.value);
		else invalid.push({ position: index + 1, reason: parsed.reason });
	});
	if (snapshots.length === 0 && invalid.length === 0) return { ok: false, error: 'noSnapshots' };

	let profile: BackupFile['profile'] = null;
	if (
		isRecord(data.profile) &&
		typeof data.profile.displayName === 'string' &&
		data.profile.displayName.trim() !== ''
	) {
		profile = {
			displayName: data.profile.displayName.trim().slice(0, 40),
			createdAt: toIso(data.profile.createdAt) ?? new Date().toISOString()
		};
	}
	return { ok: true, profile, snapshots, invalid };
}

export interface ImportPlan {
	toAdd: StatsSnapshot[];
	duplicates: { snapshot: StatsSnapshot; reason: 'id' | 'content' }[];
}

/**
 * Decides which backup snapshots to add. Existing records are never overwritten. A duplicate has
 * the same id, or the same statistics date and identical values; identical values on a different
 * date are a different observation and are kept.
 */
export function planImport(
	existing: readonly StatsSnapshot[],
	incoming: readonly StatsSnapshot[]
): ImportPlan {
	const plan: ImportPlan = { toAdd: [], duplicates: [] };
	const known: StatsSnapshot[] = [...existing];

	for (const snapshot of incoming) {
		if (known.some((s) => s.id === snapshot.id)) {
			plan.duplicates.push({ snapshot, reason: 'id' });
		} else if (
			known.some((s) => s.capturedAt === snapshot.capturedAt && statsEqual(s.stats, snapshot.stats))
		) {
			plan.duplicates.push({ snapshot, reason: 'content' });
		} else {
			plan.toAdd.push(snapshot);
			known.push(snapshot);
		}
	}
	return plan;
}
