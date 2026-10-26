import {
	STAT_KEYS,
	isExtraStatKey,
	type ExtraStatKey,
	type StatKey,
	type StatValues
} from './statDefinitions.ts';

export interface PlayerStats {
	level: number;
	/** The career screen does not show the rank title, so it is usually unknown. */
	rankTitle: string | null;
	kills: number;
	deaths: number;
	missionsPlayed: number;
	missionsCompleted: number;
	shotsFired: number | null;
	shotsHit: number | null;
	timePlayedSeconds: number | null;
	/** Additional career statistics; a key is absent when the value is unknown. */
	extra: Partial<Record<ExtraStatKey, number>>;
}

export interface PlayerProfile {
	id: 'me';
	displayName: string;
	createdAt: string;
}

export type CapturedAtSource = 'file' | 'user' | 'import-time';

export interface StatsSnapshot {
	id: string;
	/** Statistics date, ISO 8601: when the career screen was captured. */
	capturedAt: string;
	/** When the snapshot was added to this app, ISO 8601. */
	importedAt: string;
	capturedAtSource: CapturedAtSource;
	source: 'manual' | 'screenshot';
	stats: PlayerStats;
	/** The user confirmed that game statistics were reset before this snapshot. */
	resetConfirmed?: boolean;
	/** The user excluded this snapshot from analytics (e.g. misrecognized values). */
	excluded?: boolean;
}

function ratio(numerator: number, denominator: number): number | null {
	return denominator > 0 ? numerator / denominator : null;
}

export function kdRatio(stats: PlayerStats): number | null {
	return ratio(stats.kills, stats.deaths);
}

export function successRate(stats: PlayerStats): number | null {
	return ratio(stats.missionsCompleted, stats.missionsPlayed);
}

export function accuracy(stats: PlayerStats): number | null {
	if (stats.shotsFired === null || stats.shotsHit === null) return null;
	return ratio(stats.shotsHit, stats.shotsFired);
}

export function killsPerMission(stats: PlayerStats): number | null {
	return ratio(stats.kills, stats.missionsPlayed);
}

export function deathsPerMission(stats: PlayerStats): number | null {
	return ratio(stats.deaths, stats.missionsPlayed);
}

export function killsPerHour(stats: PlayerStats): number | null {
	if (stats.timePlayedSeconds === null) return null;
	return ratio(stats.kills, stats.timePlayedSeconds / 3600);
}

export function killShare(stats: PlayerStats): number | null {
	return ratio(stats.kills, stats.kills + stats.deaths);
}

export function getStatValue(stats: PlayerStats, key: StatKey): number | null {
	if (isExtraStatKey(key)) return stats.extra[key] ?? null;
	switch (key) {
		case 'timeInMissions':
			return stats.timePlayedSeconds;
		default:
			return stats[key];
	}
}

export function statsEqual(a: PlayerStats, b: PlayerStats): boolean {
	const scalarKeys = [
		'level',
		'kills',
		'deaths',
		'missionsPlayed',
		'missionsCompleted',
		'shotsFired',
		'shotsHit',
		'timePlayedSeconds'
	] as const;
	if (scalarKeys.some((key) => a[key] !== b[key])) return false;

	const extraKeys = new Set([
		...Object.keys(a.extra),
		...Object.keys(b.extra)
	]) as Set<ExtraStatKey>;
	for (const key of extraKeys) {
		if ((a.extra[key] ?? null) !== (b.extra[key] ?? null)) return false;
	}
	return true;
}

export function toStatValues(stats: PlayerStats): StatValues {
	const values: StatValues = {};
	for (const key of STAT_KEYS) {
		const value = getStatValue(stats, key);
		if (value !== null) values[key] = value;
	}
	return values;
}
