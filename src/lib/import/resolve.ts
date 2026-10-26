import {
	REQUIRED_STAT_KEYS,
	STAT_KEYS,
	isExtraStatKey,
	type ExtraStatKey,
	type StatKey,
	type StatValues
} from '../domain/statDefinitions.ts';
import type { PlayerStats } from '../domain/stats.ts';
import type { Candidate, MergedStat, ValidationIssue } from './types.ts';

export type { StatValues };

export interface Decisions {
	values: Partial<Record<StatKey, { value: number; origin: 'chosen' | 'edited' }>>;
	confirmed: readonly StatKey[];
}

export type ResolvedState =
	'ok' | 'confirmed' | 'chosen' | 'edited' | 'uncertain' | 'conflict' | 'missing';

export interface ResolvedStat {
	key: StatKey;
	state: ResolvedState;
	value: number | null;
	candidates: Candidate[];
	blocking: boolean;
}

export function resolveStats(merged: MergedStat[], decisions: Decisions): ResolvedStat[] {
	return merged.map((stat) => {
		const decision = decisions.values[stat.key];
		const required = REQUIRED_STAT_KEYS.includes(stat.key);

		let state: ResolvedState;
		let value: number | null;
		if (decision) {
			state = decision.origin;
			value = decision.value;
		} else if (stat.status === 'uncertain' && decisions.confirmed.includes(stat.key)) {
			state = 'confirmed';
			value = stat.value;
		} else {
			state = stat.status;
			value = stat.value;
		}

		const blocking =
			state === 'uncertain' || state === 'conflict' || (state === 'missing' && required);
		return { key: stat.key, state, value, candidates: stat.candidates, blocking };
	});
}

export function toValues(resolved: ResolvedStat[]): StatValues {
	const values: StatValues = {};
	for (const stat of resolved) {
		if (!stat.blocking && stat.value !== null) values[stat.key] = stat.value;
	}
	return values;
}

const MAX_LEVEL = 999;

/** Consistency checks that catch OCR mistakes the recognizer itself is unaware of. */
export function validateValues(values: StatValues): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const { level, kills, missionsPlayed, missionsCompleted, shotsFired, shotsHit } = values;

	if (level !== undefined && (level < 1 || level > MAX_LEVEL)) {
		issues.push({ code: 'levelOutOfRange', severity: 'error', keys: ['level'], params: {} });
	}

	if (
		missionsPlayed !== undefined &&
		missionsCompleted !== undefined &&
		missionsCompleted > missionsPlayed
	) {
		issues.push({
			code: 'completedExceedsPlayed',
			severity: 'error',
			keys: ['missionsCompleted', 'missionsPlayed'],
			params: { completed: missionsCompleted, played: missionsPlayed }
		});
	}

	if (shotsFired !== undefined && shotsHit !== undefined && shotsHit > shotsFired) {
		issues.push({
			code: 'hitsExceedShots',
			severity: 'error',
			keys: ['shotsHit', 'shotsFired'],
			params: { hits: shotsHit, shots: shotsFired }
		});
	}

	if (kills !== undefined) {
		const subsets = [
			'killsBugs',
			'killsAutomatons',
			'killsIlluminate',
			'grenadeKills',
			'meleeKills',
			'eagleKills'
		] as const;
		for (const key of subsets) {
			const value = values[key];
			if (value !== undefined && value > kills) {
				issues.push({
					code: 'subKillsExceedKills',
					severity: 'error',
					keys: [key, 'kills'],
					params: { value, kills }
				});
			}
		}

		const { killsBugs, killsAutomatons, killsIlluminate } = values;
		if (killsBugs !== undefined && killsAutomatons !== undefined && killsIlluminate !== undefined) {
			const sum = killsBugs + killsAutomatons + killsIlluminate;
			if (sum !== kills) {
				issues.push({
					code: 'factionKillsMismatch',
					severity: 'warning',
					keys: ['kills', 'killsBugs', 'killsAutomatons', 'killsIlluminate'],
					params: { sum, kills }
				});
			}
		}
	}

	const categories = [
		'orbitalStratagems',
		'defensiveStratagems',
		'eagleStratagems',
		'supplyStratagems',
		'reinforcementStratagems'
	] as const;
	const present = categories.map((key) => values[key]);
	if (values.stratagemsUsed !== undefined && present.every((v) => v !== undefined)) {
		const sum = (present as number[]).reduce((a, b) => a + b, 0);
		if (sum > values.stratagemsUsed) {
			issues.push({
				code: 'stratagemsExceedTotal',
				severity: 'error',
				keys: ['stratagemsUsed', ...categories],
				params: { sum, total: values.stratagemsUsed }
			});
		}
	}
	return issues;
}

export function buildPlayerStats(values: StatValues): PlayerStats | null {
	const { level, kills, deaths, missionsPlayed, missionsCompleted } = values;
	if (
		level === undefined ||
		kills === undefined ||
		deaths === undefined ||
		missionsPlayed === undefined ||
		missionsCompleted === undefined
	) {
		return null;
	}

	const extra: Partial<Record<ExtraStatKey, number>> = {};
	for (const key of STAT_KEYS) {
		const value = values[key];
		if (isExtraStatKey(key) && value !== undefined) extra[key] = value;
	}

	return {
		level,
		rankTitle: null,
		kills,
		deaths,
		missionsPlayed,
		missionsCompleted,
		shotsFired: values.shotsFired ?? null,
		shotsHit: values.shotsHit ?? null,
		timePlayedSeconds: values.timeInMissions ?? null,
		extra
	};
}
