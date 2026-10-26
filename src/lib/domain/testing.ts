import type { PlayerStats, StatsSnapshot } from './stats.ts';

export function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
	return {
		level: 10,
		rankTitle: null,
		kills: 1000,
		deaths: 100,
		missionsPlayed: 50,
		missionsCompleted: 45,
		shotsFired: 10000,
		shotsHit: 6000,
		timePlayedSeconds: 36000,
		extra: {},
		...overrides
	};
}

let counter = 0;

/** A snapshot captured `day` days after 2026-01-01 (UTC). */
export function makeSnapshot(
	day: number,
	stats: Partial<PlayerStats> = {},
	overrides: Partial<StatsSnapshot> = {}
): StatsSnapshot {
	const capturedAt = new Date(Date.UTC(2026, 0, 1 + day, 12, 0, 0)).toISOString();
	counter++;
	return {
		id: `snapshot-${counter}`,
		capturedAt,
		importedAt: capturedAt,
		capturedAtSource: 'file',
		source: 'screenshot',
		stats: makeStats(stats),
		...overrides
	};
}
