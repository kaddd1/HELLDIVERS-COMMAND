import type { StatValues } from '../domain/statDefinitions.ts';

export type RatioId =
	| 'kd'
	| 'success'
	| 'accuracy'
	| 'killsPerMission'
	| 'deathsPerMission'
	| 'killsPerHour'
	| 'objectivesPerMission'
	| 'samplesPerMission'
	| 'xpPerMission'
	| 'stratagemsPerMission'
	| 'friendlyFirePer1000';

export type RatioFormat = 'decimal' | 'percent';

export interface RatioDefinition {
	id: RatioId;
	format: RatioFormat;
	/** Works on cumulative values and on differences between snapshots alike. */
	compute: (values: StatValues) => number | null;
}

function divide(numerator: number | undefined, denominator: number | undefined): number | null {
	if (numerator === undefined || denominator === undefined || denominator <= 0) return null;
	return numerator / denominator;
}

export const RATIOS: readonly RatioDefinition[] = [
	{ id: 'kd', format: 'decimal', compute: (v) => divide(v.kills, v.deaths) },
	{
		id: 'success',
		format: 'percent',
		compute: (v) => divide(v.missionsCompleted, v.missionsPlayed)
	},
	{ id: 'accuracy', format: 'percent', compute: (v) => divide(v.shotsHit, v.shotsFired) },
	{
		id: 'killsPerMission',
		format: 'decimal',
		compute: (v) => divide(v.kills, v.missionsPlayed)
	},
	{
		id: 'deathsPerMission',
		format: 'decimal',
		compute: (v) => divide(v.deaths, v.missionsPlayed)
	},
	{
		id: 'killsPerHour',
		format: 'decimal',
		compute: (v) =>
			v.timeInMissions === undefined ? null : divide(v.kills, v.timeInMissions / 3600)
	},
	{
		id: 'objectivesPerMission',
		format: 'decimal',
		compute: (v) => divide(v.objectivesCompleted, v.missionsPlayed)
	},
	{
		id: 'samplesPerMission',
		format: 'decimal',
		compute: (v) => divide(v.samplesCollected, v.missionsPlayed)
	},
	{
		id: 'xpPerMission',
		format: 'decimal',
		compute: (v) => divide(v.totalXp, v.missionsPlayed)
	},
	{
		id: 'stratagemsPerMission',
		format: 'decimal',
		compute: (v) => divide(v.stratagemsUsed, v.missionsPlayed)
	},
	{
		id: 'friendlyFirePer1000',
		format: 'decimal',
		compute: (v) => {
			const share = divide(v.friendlyKills, v.kills);
			return share === null ? null : share * 1000;
		}
	}
];

const byId = new Map(RATIOS.map((ratio) => [ratio.id, ratio]));

export function getRatio(id: RatioId): RatioDefinition {
	return byId.get(id) as RatioDefinition;
}
