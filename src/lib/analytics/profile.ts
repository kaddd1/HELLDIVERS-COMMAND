import type { StatValues } from '../domain/statDefinitions.ts';
import { toStatValues, type StatsSnapshot } from '../domain/stats.ts';
import { buildIntervals, compareInHistory, type Interval } from './history.ts';
import { getRatio } from './metrics.ts';

/**
 * Combat profile: rates calculated from the difference between two snapshots and compared with the
 * player's own baseline. There is no external benchmark, so nothing here rates skill; an index of
 * 100 simply means "same as usual for this player".
 */

export type MetricId =
	| 'aggression'
	| 'pace'
	| 'risk'
	| 'accuracy'
	| 'success'
	| 'objectives'
	| 'stratagems'
	| 'extractions'
	| 'kd'
	| 'friendlyFire'
	| 'samples'
	| 'xpPerHour';

export interface MetricDefinition {
	id: MetricId;
	/** Drawn on the radar; the others appear only in the table. */
	radar: boolean;
	format: 'decimal' | 'percent';
	compute: (values: StatValues) => number | null;
	/** How many "opportunities" the rate is based on: missions, shots, deaths or kills. */
	sample: (values: StatValues) => number;
	/** Below this sample the value is considered unreliable and is not interpreted. */
	minSample: number;
}

export const MIN_MISSIONS = 5;
export const MIN_SHOTS = 1000;
export const MIN_DEATHS = 5;
export const MIN_KILLS = 1000;
/** Relative changes smaller than this are never called a real difference. */
export const MIN_BAND = 0.1;
/** Index values are drawn up to this on the radar. */
export const INDEX_CAP = 200;

function divide(a: number | undefined, b: number | undefined): number | null {
	if (a === undefined || b === undefined || b <= 0) return null;
	return a / b;
}

const missions = (v: StatValues): number => v.missionsPlayed ?? 0;
const ratio = (id: Parameters<typeof getRatio>[0]) => (v: StatValues) => getRatio(id).compute(v);

export const METRICS: readonly MetricDefinition[] = [
	{
		id: 'aggression',
		radar: true,
		format: 'decimal',
		compute: ratio('killsPerMission'),
		sample: missions,
		minSample: MIN_MISSIONS
	},
	{
		id: 'pace',
		radar: true,
		format: 'decimal',
		compute: ratio('killsPerHour'),
		sample: missions,
		minSample: MIN_MISSIONS
	},
	{
		id: 'risk',
		radar: true,
		format: 'decimal',
		compute: ratio('deathsPerMission'),
		sample: missions,
		minSample: MIN_MISSIONS
	},
	{
		id: 'accuracy',
		radar: true,
		format: 'percent',
		compute: ratio('accuracy'),
		sample: (v) => v.shotsFired ?? 0,
		minSample: MIN_SHOTS
	},
	{
		id: 'success',
		radar: true,
		format: 'percent',
		compute: ratio('success'),
		sample: missions,
		minSample: MIN_MISSIONS
	},
	{
		id: 'objectives',
		radar: true,
		format: 'decimal',
		compute: ratio('objectivesPerMission'),
		sample: missions,
		minSample: MIN_MISSIONS
	},
	{
		id: 'stratagems',
		radar: true,
		format: 'decimal',
		compute: ratio('stratagemsPerMission'),
		sample: missions,
		minSample: MIN_MISSIONS
	},
	{
		id: 'extractions',
		radar: true,
		format: 'decimal',
		compute: (v) => divide(v.successfulExtractions, v.missionsPlayed),
		sample: missions,
		minSample: MIN_MISSIONS
	},
	{
		id: 'kd',
		radar: false,
		format: 'decimal',
		compute: ratio('kd'),
		sample: (v) => v.deaths ?? 0,
		minSample: MIN_DEATHS
	},
	{
		id: 'friendlyFire',
		radar: false,
		format: 'decimal',
		compute: ratio('friendlyFirePer1000'),
		sample: (v) => v.kills ?? 0,
		minSample: MIN_KILLS
	},
	{
		id: 'samples',
		radar: false,
		format: 'decimal',
		compute: ratio('samplesPerMission'),
		sample: missions,
		minSample: MIN_MISSIONS
	},
	{
		id: 'xpPerHour',
		radar: false,
		format: 'decimal',
		compute: (v) =>
			v.timeInMissions === undefined ? null : divide(v.totalXp, v.timeInMissions / 3600),
		sample: missions,
		minSample: MIN_MISSIONS
	}
];

const byId = new Map(METRICS.map((m) => [m.id, m]));

export function getMetric(id: MetricId): MetricDefinition {
	return byId.get(id) as MetricDefinition;
}

export interface MetricResult {
	value: number | null;
	sample: number;
	/** The value exists and rests on enough data to be interpreted. */
	reliable: boolean;
}

export function computeMetric(definition: MetricDefinition, values: StatValues): MetricResult {
	const value = definition.compute(values);
	const sample = definition.sample(values);
	return { value, sample, reliable: value !== null && sample >= definition.minSample };
}

/** Relative change below which a difference is treated as noise, given the sample size. */
export function noiseBand(sample: number): number {
	return sample > 0 ? Math.max(MIN_BAND, 1 / Math.sqrt(sample)) : Number.POSITIVE_INFINITY;
}

export type Verdict = 'higher' | 'lower' | 'same' | 'unknown';

export interface MetricComparison {
	id: MetricId;
	period: MetricResult;
	baseline: MetricResult;
	/** 100 × period / baseline; `null` unless both values are reliable and the baseline is positive. */
	index: number | null;
	/** Relative change, period / baseline − 1. */
	change: number | null;
	/** Noise band applied to the change. */
	band: number;
	verdict: Verdict;
}

/** Compares a period with a baseline metric by metric. */
export function compareMetrics(period: StatValues, baseline: StatValues): MetricComparison[] {
	return METRICS.map((definition) => {
		const p = computeMetric(definition, period);
		const b = computeMetric(definition, baseline);
		const comparable = p.reliable && b.reliable && (b.value ?? 0) > 0;
		const change = comparable ? (p.value as number) / (b.value as number) - 1 : null;
		const band = noiseBand(Math.min(p.sample, b.sample));
		const verdict: Verdict =
			change === null ? 'unknown' : change > band ? 'higher' : change < -band ? 'lower' : 'same';
		return {
			id: definition.id,
			period: p,
			baseline: b,
			index: change === null ? null : (change + 1) * 100,
			change,
			band,
			verdict
		};
	});
}

/* ---------- Composition: how kills and stratagems are distributed ---------- */

export type CompositionId = 'factions' | 'methods' | 'stratagems';

export interface CompositionPart {
	id: string;
	value: number;
	/** 0..1 */
	share: number;
}

export interface Composition {
	id: CompositionId;
	total: number;
	parts: CompositionPart[];
}

const MIN_COMPOSITION_TOTAL: Record<CompositionId, number> = {
	factions: 500,
	methods: 500,
	stratagems: 50
};

function composition(
	id: CompositionId,
	entries: [string, number | undefined][],
	total: number | undefined
): Composition | null {
	if (entries.some(([, v]) => v === undefined)) return null;
	const known = entries as [string, number][];
	const sum = known.reduce((s, [, v]) => s + v, 0);
	const whole = total ?? sum;
	if (whole < MIN_COMPOSITION_TOTAL[id] || sum > whole) return null;

	const parts = known.map(([part, value]) => ({ id: part, value, share: value / whole }));
	if (whole > sum) parts.push({ id: 'other', value: whole - sum, share: (whole - sum) / whole });
	return { id, total: whole, parts };
}

/** Distribution of kills by faction and method, and of stratagem uses by type. */
export function buildCompositions(values: StatValues): Composition[] {
	return [
		composition(
			'factions',
			[
				['bugs', values.killsBugs],
				['automatons', values.killsAutomatons],
				['illuminate', values.killsIlluminate]
			],
			values.kills
		),
		composition(
			'methods',
			[
				['grenades', values.grenadeKills],
				['melee', values.meleeKills],
				['eagle', values.eagleKills]
			],
			values.kills
		),
		composition(
			'stratagems',
			[
				['orbital', values.orbitalStratagems],
				['defensive', values.defensiveStratagems],
				['eagle', values.eagleStratagems],
				['supply', values.supplyStratagems],
				['reinforcement', values.reinforcementStratagems]
			],
			values.stratagemsUsed
		)
	].filter((c): c is Composition => c !== null);
}

/** A share must move by at least this many percentage points to be reported. */
export const MIN_SHIFT = 0.05;

export interface CompositionShift {
	group: CompositionId;
	part: string;
	from: number;
	to: number;
}

export function compositionShifts(
	period: Composition[],
	baseline: Composition[]
): CompositionShift[] {
	const shifts: CompositionShift[] = [];
	for (const p of period) {
		const b = baseline.find((c) => c.id === p.id);
		if (!b) continue;
		for (const part of p.parts) {
			const before = b.parts.find((x) => x.id === part.id)?.share ?? 0;
			if (Math.abs(part.share - before) >= MIN_SHIFT) {
				shifts.push({ group: p.id, part: part.id, from: before, to: part.share });
			}
		}
	}
	return shifts.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
}

/* ---------- Insights ---------- */

export type Insight =
	| {
			kind: 'metric';
			id: MetricId;
			direction: 'higher' | 'lower';
			period: number;
			baseline: number;
			change: number;
	  }
	| { kind: 'style'; id: 'riskier' | 'efficient' | 'costlier' | 'calmer' }
	| ({ kind: 'shift' } & CompositionShift)
	| { kind: 'stable' }
	| { kind: 'notEnough'; reliable: number };

const MAX_METRIC_INSIGHTS = 4;
const MAX_SHIFT_INSIGHTS = 2;

/** Observations about how the period differs from the baseline. Nothing here judges skill. */
export function buildInsights(
	comparisons: MetricComparison[],
	shifts: CompositionShift[]
): Insight[] {
	const insights: Insight[] = [];
	const reliable = comparisons.filter((c) => c.verdict !== 'unknown');
	if (reliable.length < 3) return [{ kind: 'notEnough', reliable: reliable.length }];

	const verdict = (id: MetricId) => comparisons.find((c) => c.id === id)?.verdict ?? 'unknown';
	const aggression = verdict('aggression');
	const risk = verdict('risk');
	if (aggression !== 'unknown' && risk !== 'unknown') {
		if (aggression === 'higher' && risk === 'higher')
			insights.push({ kind: 'style', id: 'riskier' });
		else if (aggression === 'higher') insights.push({ kind: 'style', id: 'efficient' });
		else if (risk === 'higher') insights.push({ kind: 'style', id: 'costlier' });
		else if (aggression === 'lower' && risk === 'lower')
			insights.push({ kind: 'style', id: 'calmer' });
	}

	const deviations = reliable
		.filter((c) => c.verdict === 'higher' || c.verdict === 'lower')
		.sort((a, b) => Math.abs(b.change as number) / b.band - Math.abs(a.change as number) / a.band)
		.slice(0, MAX_METRIC_INSIGHTS);
	for (const c of deviations) {
		insights.push({
			kind: 'metric',
			id: c.id,
			direction: c.verdict as 'higher' | 'lower',
			period: c.period.value as number,
			baseline: c.baseline.value as number,
			change: c.change as number
		});
	}
	for (const shift of shifts.slice(0, MAX_SHIFT_INSIGHTS))
		insights.push({ kind: 'shift', ...shift });

	if (deviations.length === 0 && shifts.length === 0) insights.push({ kind: 'stable' });
	return insights;
}

/* ---------- Periods and baselines ---------- */

export type BaselineMode = 'career' | 'previous';

export interface PeriodOption {
	id: string;
	interval: Interval;
	/** The interval immediately before this one, when it is consistent. */
	previous: Interval | null;
	/** Spans the whole history rather than one interval between neighbours. */
	whole: boolean;
}

/**
 * Periods that can be analyzed: every consistent interval between neighbouring snapshots, newest
 * first, plus the whole history when it holds several intervals and no reset or anomaly.
 */
export function buildPeriodOptions(active: readonly StatsSnapshot[]): PeriodOption[] {
	const intervals = buildIntervals(active);
	const options: PeriodOption[] = intervals
		.map((interval, index): PeriodOption | null => {
			if (interval.status !== 'ok') return null;
			const before = intervals[index - 1];
			return {
				id: `${interval.from.id}>${interval.to.id}`,
				interval,
				previous: before?.status === 'ok' ? before : null,
				whole: false
			};
		})
		.filter((option): option is PeriodOption => option !== null)
		.reverse();

	if (intervals.length >= 2) {
		const whole = compareInHistory(active, active[0], active[active.length - 1]);
		if (whole.status === 'ok') {
			options.push({ id: 'whole', interval: whole, previous: null, whole: true });
		}
	}
	return options;
}

/** The values a period is compared against, or `null` if that baseline is unavailable. */
export function baselineValues(option: PeriodOption, mode: BaselineMode): StatValues | null {
	if (mode === 'career') return toStatValues(option.interval.from.stats);
	return option.previous ? option.previous.deltas : null;
}
