import type { StatKey } from '../domain/statDefinitions.ts';
import { toStatValues, type StatsSnapshot } from '../domain/stats.ts';
import { buildIntervals, type Interval } from './history.ts';
import { getRatio, type RatioId } from './metrics.ts';

/** Minimum interval volume for a ratio to count as a record; tiny samples are not meaningful. */
export const RECORD_THRESHOLDS = {
	deaths: 5,
	missions: 5,
	shots: 1000
} as const;

export type RecordId =
	| 'mostKills'
	| 'mostMissionsCompleted'
	| 'mostXp'
	| 'mostStratagems'
	| 'bestKd'
	| 'bestSuccess'
	| 'bestAccuracy'
	| 'peakKd';

export interface PersonalRecord {
	id: RecordId;
	value: number;
	format: 'int' | 'decimal' | 'percent';
	from: StatsSnapshot | null;
	to: StatsSnapshot;
}

interface Found {
	interval: Interval;
	value: number;
}

function bestInterval(
	intervals: readonly Interval[],
	valueOf: (interval: Interval) => number | null
): Found | null {
	let best: Found | null = null;
	for (const interval of intervals) {
		if (interval.status !== 'ok') continue;
		const value = valueOf(interval);
		if (value !== null && (best === null || value > best.value)) best = { interval, value };
	}
	return best;
}

/**
 * Records that can honestly be derived from cumulative snapshots: the best change between two
 * snapshots, and the best cumulative K/D seen. Nothing here describes a single mission.
 */
export function computeRecords(active: readonly StatsSnapshot[]): PersonalRecord[] {
	const intervals = buildIntervals(active);
	const records: PersonalRecord[] = [];

	const delta = (key: StatKey) => (interval: Interval) => interval.deltas[key] ?? null;
	const ratio = (id: RatioId, guard: (interval: Interval) => boolean) => (interval: Interval) =>
		guard(interval) ? getRatio(id).compute(interval.deltas) : null;

	const add = (id: RecordId, format: PersonalRecord['format'], found: Found | null): void => {
		if (!found || found.value <= 0) return;
		records.push({
			id,
			format,
			value: found.value,
			from: found.interval.from,
			to: found.interval.to
		});
	};

	add('mostKills', 'int', bestInterval(intervals, delta('kills')));
	add('mostMissionsCompleted', 'int', bestInterval(intervals, delta('missionsCompleted')));
	add('mostXp', 'int', bestInterval(intervals, delta('totalXp')));
	add('mostStratagems', 'int', bestInterval(intervals, delta('stratagemsUsed')));
	add(
		'bestKd',
		'decimal',
		bestInterval(
			intervals,
			ratio('kd', (i) => (i.deltas.deaths ?? 0) >= RECORD_THRESHOLDS.deaths)
		)
	);
	add(
		'bestSuccess',
		'percent',
		bestInterval(
			intervals,
			ratio('success', (i) => (i.deltas.missionsPlayed ?? 0) >= RECORD_THRESHOLDS.missions)
		)
	);
	add(
		'bestAccuracy',
		'percent',
		bestInterval(
			intervals,
			ratio('accuracy', (i) => (i.deltas.shotsFired ?? 0) >= RECORD_THRESHOLDS.shots)
		)
	);

	let peak: { snapshot: StatsSnapshot; value: number } | null = null;
	for (const snapshot of active) {
		const value = getRatio('kd').compute(toStatValues(snapshot.stats));
		if (value !== null && (peak === null || value > peak.value)) peak = { snapshot, value };
	}
	if (peak && active.length >= 2) {
		records.push({
			id: 'peakKd',
			format: 'decimal',
			value: peak.value,
			from: null,
			to: peak.snapshot
		});
	}
	return records;
}
