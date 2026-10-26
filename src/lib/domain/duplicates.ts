import { statsEqual, type PlayerStats, type StatsSnapshot } from './stats.ts';

function time(iso: string): number {
	return new Date(iso).getTime();
}

/**
 * Finds an existing snapshot that makes a new import redundant: one with identical values that
 * is the closest earlier or later snapshot in time. Identical values far apart in history, with
 * other snapshots in between, are legitimate (nothing changed) only if the counters really are
 * equal, so they are not reported unless they are neighbours.
 */
export function findDuplicate(
	existing: readonly StatsSnapshot[],
	stats: PlayerStats,
	capturedAt: string
): StatsSnapshot | null {
	const t = time(capturedAt);
	let before: StatsSnapshot | null = null;
	let after: StatsSnapshot | null = null;

	for (const snapshot of existing) {
		const s = time(snapshot.capturedAt);
		if (s <= t && (before === null || s >= time(before.capturedAt))) before = snapshot;
		if (s > t && (after === null || s < time(after.capturedAt))) after = snapshot;
	}
	for (const neighbour of [before, after]) {
		if (neighbour && statsEqual(neighbour.stats, stats)) return neighbour;
	}
	return null;
}
