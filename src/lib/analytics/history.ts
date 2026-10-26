import { STAT_KEYS, type StatKey, type StatValues } from '../domain/statDefinitions.ts';
import { toStatValues, type StatsSnapshot } from '../domain/stats.ts';

/** Cumulative counters that can only grow; a decrease means a reset or a misread value. */
export const RESET_COUNTERS = [
	'kills',
	'deaths',
	'missionsPlayed',
	'missionsCompleted'
] as const satisfies readonly StatKey[];

/**
 * - `ok`: counters only grew, so differences are meaningful.
 * - `anomaly`: a counter decreased and the user has not decided why (reset or OCR error).
 * - `reset`: the user confirmed that game statistics were reset in this interval.
 */
export type IntervalStatus = 'ok' | 'anomaly' | 'reset';

export interface Interval {
	from: StatsSnapshot;
	to: StatsSnapshot;
	status: IntervalStatus;
	decreased: StatKey[];
	deltas: StatValues;
	seconds: number;
}

function time(snapshot: StatsSnapshot): number {
	return new Date(snapshot.capturedAt).getTime();
}

export function sortSnapshots(snapshots: readonly StatsSnapshot[]): StatsSnapshot[] {
	return [...snapshots].sort(
		(a, b) => time(a) - time(b) || a.importedAt.localeCompare(b.importedAt)
	);
}

export function activeSnapshots(snapshots: readonly StatsSnapshot[]): StatsSnapshot[] {
	return sortSnapshots(snapshots).filter((snapshot) => !snapshot.excluded);
}

/**
 * Compares two snapshots (`from` is earlier). `crossed` lists the snapshots after `from` up to
 * and including `to`; if any is a confirmed reset, the whole range is a reset.
 */
export function compareSnapshots(
	from: StatsSnapshot,
	to: StatsSnapshot,
	crossed: readonly StatsSnapshot[] = [to]
): Interval {
	const before = toStatValues(from.stats);
	const after = toStatValues(to.stats);

	const decreased = RESET_COUNTERS.filter((key) => {
		const a = before[key];
		const b = after[key];
		return a !== undefined && b !== undefined && b < a;
	});

	const status: IntervalStatus = crossed.some((s) => s.resetConfirmed)
		? 'reset'
		: decreased.length > 0
			? 'anomaly'
			: 'ok';

	const deltas: StatValues = {};
	if (status === 'ok') {
		for (const key of STAT_KEYS) {
			const a = before[key];
			const b = after[key];
			// A single non-counter statistic that shrank is left out rather than shown as negative.
			if (a !== undefined && b !== undefined && b >= a) deltas[key] = b - a;
		}
	}

	return {
		from,
		to,
		status,
		decreased,
		deltas,
		seconds: Math.max(0, (time(to) - time(from)) / 1000)
	};
}

export function buildIntervals(active: readonly StatsSnapshot[]): Interval[] {
	return active.slice(1).map((to, index) => compareSnapshots(active[index], to));
}

export function compareInHistory(
	active: readonly StatsSnapshot[],
	a: StatsSnapshot,
	b: StatsSnapshot
): Interval {
	const [from, to] = sortSnapshots([a, b]);
	const start = active.findIndex((s) => s.id === from.id);
	const end = active.findIndex((s) => s.id === to.id);
	const crossed = start >= 0 && end > start ? active.slice(start + 1, end + 1) : [to];
	return compareSnapshots(from, to, crossed);
}

export function previewInsertion(
	existing: readonly StatsSnapshot[],
	candidate: StatsSnapshot
): { before: Interval | null; after: Interval | null } {
	const active = activeSnapshots([...existing, candidate]);
	const index = active.findIndex((s) => s.id === candidate.id);
	return {
		before: index > 0 ? compareSnapshots(active[index - 1], candidate) : null,
		after:
			index >= 0 && index < active.length - 1
				? compareSnapshots(candidate, active[index + 1])
				: null
	};
}

export function findAnomalies(intervals: readonly Interval[]): Interval[] {
	return intervals.filter((interval) => interval.status === 'anomaly');
}

export type RangeId = '7' | '30' | '90' | 'all';

const DAY = 24 * 60 * 60 * 1000;

/** Snapshots within the last N days, counted back from the newest snapshot (not from today). */
export function filterRange(active: readonly StatsSnapshot[], range: RangeId): StatsSnapshot[] {
	if (range === 'all' || active.length === 0) return [...active];
	const latest = time(active[active.length - 1]);
	const limit = latest - Number(range) * DAY;
	return active.filter((snapshot) => time(snapshot) >= limit);
}

export interface Series {
	points: [number, number | null][];
	breaks: { t: number; status: 'reset' | 'anomaly' }[];
}

/**
 * Cumulative series over time. Across a reset or anomaly the line is cut instead of connected,
 * so a drop is never drawn as progress.
 */
export function buildSeries(
	active: readonly StatsSnapshot[],
	valueOf: (snapshot: StatsSnapshot) => number | null
): Series {
	const points: Series['points'] = [];
	const breaks: Series['breaks'] = [];

	active.forEach((snapshot, index) => {
		const t = time(snapshot);
		if (index > 0) {
			const interval = compareSnapshots(active[index - 1], snapshot);
			if (interval.status !== 'ok') {
				const previous = time(active[index - 1]);
				points.push([previous + (t - previous) / 2, null]);
				breaks.push({ t, status: interval.status });
			}
		}
		points.push([t, valueOf(snapshot)]);
	});
	return { points, breaks };
}

export interface IntervalPoint {
	interval: Interval;
	t: number;
	value: number | null;
}

export function buildIntervalSeries(
	intervals: readonly Interval[],
	valueOf: (interval: Interval) => number | null
): IntervalPoint[] {
	return intervals.map((interval) => ({
		interval,
		t: time(interval.to),
		value: interval.status === 'ok' ? valueOf(interval) : null
	}));
}
