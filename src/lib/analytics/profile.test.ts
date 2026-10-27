import { describe, expect, it } from 'vitest';
import type { PlayerStats } from '../domain/stats.ts';
import { makeSnapshot } from '../domain/testing.ts';
import {
	INDEX_CAP,
	baselineValues,
	buildCompositions,
	buildInsights,
	buildPeriodOptions,
	compareMetrics,
	compositionShifts,
	computeMetric,
	getMetric,
	noiseBand
} from './profile.ts';

/** Snapshot with the extras the profile needs. `scale` grows every counter proportionally. */
function snap(day: number, stats: Partial<PlayerStats> = {}, extra: PlayerStats['extra'] = {}) {
	return makeSnapshot(day, {
		extra: {
			objectivesCompleted: 100,
			stratagemsUsed: 200,
			successfulExtractions: 40,
			samplesCollected: 150,
			totalXp: 50000,
			killsBugs: 400,
			killsAutomatons: 400,
			killsIlluminate: 200,
			grenadeKills: 50,
			meleeKills: 10,
			eagleKills: 100,
			orbitalStratagems: 40,
			defensiveStratagems: 20,
			eagleStratagems: 40,
			supplyStratagems: 50,
			reinforcementStratagems: 40,
			...extra
		},
		...stats
	});
}

describe('noiseBand', () => {
	it('never goes below 10 percent and widens for small samples', () => {
		expect(noiseBand(10000)).toBe(0.1);
		expect(noiseBand(100)).toBeCloseTo(0.1, 5);
		expect(noiseBand(25)).toBeCloseTo(0.2, 5);
		expect(noiseBand(4)).toBeCloseTo(0.5, 5);
	});

	it('has no tolerance basis without a sample', () => {
		expect(noiseBand(0)).toBe(Number.POSITIVE_INFINITY);
	});
});

describe('computeMetric', () => {
	it('computes rates from a value bag', () => {
		const values = { kills: 600, missionsPlayed: 20, deaths: 40, shotsFired: 5000, shotsHit: 3000 };
		expect(computeMetric(getMetric('aggression'), values)).toMatchObject({
			value: 30,
			sample: 20,
			reliable: true
		});
		expect(computeMetric(getMetric('risk'), values).value).toBe(2);
		expect(computeMetric(getMetric('accuracy'), values)).toMatchObject({
			value: 0.6,
			sample: 5000
		});
		expect(computeMetric(getMetric('kd'), values).value).toBe(15);
	});

	it('marks small samples as unreliable instead of hiding the value', () => {
		const result = computeMetric(getMetric('aggression'), { kills: 90, missionsPlayed: 3 });
		expect(result.value).toBe(30);
		expect(result.reliable).toBe(false);
	});

	it('requires enough shots for accuracy', () => {
		expect(computeMetric(getMetric('accuracy'), { shotsFired: 500, shotsHit: 250 }).reliable).toBe(
			false
		);
	});

	it('returns no value when inputs are missing or the denominator is zero', () => {
		expect(computeMetric(getMetric('pace'), { kills: 100, missionsPlayed: 10 }).value).toBeNull();
		expect(computeMetric(getMetric('kd'), { kills: 100, deaths: 0 }).value).toBeNull();
		expect(computeMetric(getMetric('objectives'), {}).reliable).toBe(false);
	});

	it('computes extraction rate and experience per hour', () => {
		const values = {
			successfulExtractions: 8,
			missionsPlayed: 10,
			totalXp: 3600,
			timeInMissions: 7200
		};
		expect(computeMetric(getMetric('extractions'), values).value).toBe(0.8);
		expect(computeMetric(getMetric('xpPerHour'), values).value).toBe(1800);
	});
});

describe('compareMetrics', () => {
	const baseline = { kills: 10000, deaths: 1000, missionsPlayed: 200, missionsCompleted: 180 };

	it('indexes a period against the baseline with 100 meaning unchanged', () => {
		const same = compareMetrics({ kills: 1000, missionsPlayed: 20 }, baseline);
		const aggression = same.find((c) => c.id === 'aggression')!;
		expect(aggression.index).toBeCloseTo(100, 5);
		expect(aggression.verdict).toBe('same');
	});

	it('reports a difference only beyond the noise band', () => {
		const higher = compareMetrics({ kills: 2000, missionsPlayed: 20 }, baseline).find(
			(c) => c.id === 'aggression'
		)!;
		expect(higher.index).toBeCloseTo(200, 5);
		expect(higher.verdict).toBe('higher');

		// +20 % with 20 missions is within the 22 % band.
		const noise = compareMetrics({ kills: 1200, missionsPlayed: 20 }, baseline).find(
			(c) => c.id === 'aggression'
		)!;
		expect(noise.change).toBeCloseTo(0.2, 5);
		expect(noise.verdict).toBe('same');

		const lower = compareMetrics({ kills: 200, missionsPlayed: 20 }, baseline).find(
			(c) => c.id === 'aggression'
		)!;
		expect(lower.verdict).toBe('lower');
	});

	it('uses a wider band for a smaller sample', () => {
		const few = compareMetrics({ kills: 350, missionsPlayed: 5 }, baseline).find(
			(c) => c.id === 'aggression'
		)!;
		expect(few.band).toBeCloseTo(1 / Math.sqrt(5), 5);
		expect(few.verdict).toBe('same');
	});

	it('gives no verdict for unreliable or unavailable metrics', () => {
		const result = compareMetrics({ kills: 90, missionsPlayed: 3 }, baseline);
		expect(result.find((c) => c.id === 'aggression')).toMatchObject({
			index: null,
			verdict: 'unknown'
		});
		expect(result.find((c) => c.id === 'objectives')).toMatchObject({
			index: null,
			verdict: 'unknown'
		});
	});

	it('does not index against a zero baseline', () => {
		const result = compareMetrics(
			{ successfulExtractions: 5, missionsPlayed: 10 },
			{ successfulExtractions: 0, missionsPlayed: 100 }
		);
		expect(result.find((c) => c.id === 'extractions')!.index).toBeNull();
	});

	it('exposes a display cap for the radar', () => {
		expect(INDEX_CAP).toBe(200);
	});
});

describe('buildCompositions', () => {
	it('splits kills by faction and method, with the remainder as other', () => {
		const groups = buildCompositions({
			kills: 1000,
			killsBugs: 450,
			killsAutomatons: 350,
			killsIlluminate: 200,
			grenadeKills: 100,
			meleeKills: 20,
			eagleKills: 180
		});
		const factions = groups.find((g) => g.id === 'factions')!;
		expect(factions.parts.map((p) => p.id)).toEqual(['bugs', 'automatons', 'illuminate']);
		expect(factions.parts[0].share).toBeCloseTo(0.45, 5);
		const methods = groups.find((g) => g.id === 'methods')!;
		expect(methods.parts.at(-1)).toMatchObject({ id: 'other', value: 700 });
	});

	it('skips groups that are incomplete, too small or inconsistent', () => {
		expect(buildCompositions({ kills: 1000, killsBugs: 500 })).toEqual([]);
		expect(
			buildCompositions({ kills: 100, killsBugs: 50, killsAutomatons: 30, killsIlluminate: 20 })
		).toEqual([]);
		const inconsistent = buildCompositions({
			kills: 1000,
			killsBugs: 800,
			killsAutomatons: 800,
			killsIlluminate: 800
		});
		expect(inconsistent.find((g) => g.id === 'factions')).toBeUndefined();
	});

	it('builds the stratagem mix from the total', () => {
		const stratagems = buildCompositions({
			stratagemsUsed: 200,
			orbitalStratagems: 40,
			defensiveStratagems: 20,
			eagleStratagems: 40,
			supplyStratagems: 50,
			reinforcementStratagems: 40
		}).find((g) => g.id === 'stratagems')!;
		expect(stratagems.parts.at(-1)).toMatchObject({ id: 'other', value: 10 });
	});
});

describe('compositionShifts', () => {
	const make = (bugs: number, automatons: number, illuminate: number) =>
		buildCompositions({
			kills: 1000,
			killsBugs: bugs,
			killsAutomatons: automatons,
			killsIlluminate: illuminate
		});

	it('reports shares that moved by five points or more, largest first', () => {
		const shifts = compositionShifts(make(300, 400, 300), make(450, 355, 195));
		expect(shifts.map((s) => s.part)).toEqual(['bugs', 'illuminate']);
		expect(shifts[0]).toMatchObject({ group: 'factions', from: 0.45, to: 0.3 });
	});

	it('ignores small movements and missing baselines', () => {
		expect(compositionShifts(make(460, 340, 200), make(450, 350, 200))).toEqual([]);
		expect(compositionShifts(make(300, 400, 300), [])).toEqual([]);
	});
});

describe('buildInsights', () => {
	const baseline = {
		kills: 10000,
		deaths: 1000,
		missionsPlayed: 200,
		missionsCompleted: 180,
		shotsFired: 100000,
		shotsHit: 60000
	};

	it('says the data is not enough when too few metrics are reliable', () => {
		const insights = buildInsights(compareMetrics({ kills: 10, missionsPlayed: 1 }, baseline), []);
		expect(insights).toEqual([{ kind: 'notEnough', reliable: 0 }]);
	});

	it('notes a stable profile when nothing differs', () => {
		const comparisons = compareMetrics(
			{
				kills: 1000,
				deaths: 100,
				missionsPlayed: 20,
				missionsCompleted: 18,
				shotsFired: 10000,
				shotsHit: 6000
			},
			baseline
		);
		expect(buildInsights(comparisons, [])).toEqual([{ kind: 'stable' }]);
	});

	it('describes more kills with more deaths as a riskier pace', () => {
		const comparisons = compareMetrics(
			{
				kills: 2000,
				deaths: 200,
				missionsPlayed: 20,
				missionsCompleted: 18,
				shotsFired: 10000,
				shotsHit: 6000
			},
			baseline
		);
		const insights = buildInsights(comparisons, []);
		expect(insights[0]).toEqual({ kind: 'style', id: 'riskier' });
		expect(insights.some((i) => i.kind === 'metric' && i.id === 'aggression')).toBe(true);
	});

	it('describes more kills without more deaths as efficient', () => {
		const comparisons = compareMetrics(
			{
				kills: 2000,
				deaths: 100,
				missionsPlayed: 20,
				missionsCompleted: 18,
				shotsFired: 10000,
				shotsHit: 6000
			},
			baseline
		);
		expect(buildInsights(comparisons, [])[0]).toEqual({ kind: 'style', id: 'efficient' });
	});

	it('describes more deaths without more kills as costlier', () => {
		const comparisons = compareMetrics(
			{
				kills: 1000,
				deaths: 300,
				missionsPlayed: 20,
				missionsCompleted: 18,
				shotsFired: 10000,
				shotsHit: 6000
			},
			baseline
		);
		expect(buildInsights(comparisons, [])[0]).toEqual({ kind: 'style', id: 'costlier' });
	});

	it('includes composition shifts and caps the list', () => {
		const comparisons = compareMetrics(
			{
				kills: 4000,
				deaths: 400,
				missionsPlayed: 20,
				missionsCompleted: 10,
				shotsFired: 10000,
				shotsHit: 3000,
				objectivesCompleted: 90,
				stratagemsUsed: 400
			},
			{ ...baseline, objectivesCompleted: 200, stratagemsUsed: 800 }
		);
		const shift = { group: 'factions' as const, part: 'bugs', from: 0.4, to: 0.6 };
		const insights = buildInsights(comparisons, [shift, shift, shift]);
		expect(insights.filter((i) => i.kind === 'metric').length).toBeLessThanOrEqual(4);
		expect(insights.filter((i) => i.kind === 'shift')).toHaveLength(2);
	});
});

describe('periods and baselines', () => {
	const a = snap(0, { kills: 1000, deaths: 100, missionsPlayed: 50, missionsCompleted: 45 });
	const b = snap(7, { kills: 1600, deaths: 150, missionsPlayed: 70, missionsCompleted: 63 });
	const c = snap(14, { kills: 2400, deaths: 190, missionsPlayed: 90, missionsCompleted: 80 });

	it('lists consistent intervals newest first, plus the whole history', () => {
		const options = buildPeriodOptions([a, b, c]);
		expect(options.map((o) => o.whole)).toEqual([false, false, true]);
		expect(options[0].interval.to).toBe(c);
		expect(options[0].previous?.to).toBe(b);
		expect(options[1].previous).toBeNull();
	});

	it('offers no periods for a single snapshot', () => {
		expect(buildPeriodOptions([a])).toEqual([]);
	});

	it('leaves out intervals with a reset or anomaly, and the whole history across them', () => {
		const reset = snap(14, { kills: 50, deaths: 5, missionsPlayed: 3, missionsCompleted: 3 }, {});
		const withReset = { ...reset, resetConfirmed: true };
		const options = buildPeriodOptions([
			a,
			b,
			withReset,
			snap(21, { kills: 600, deaths: 50, missionsPlayed: 30, missionsCompleted: 25 })
		]);
		expect(options.some((o) => o.whole)).toBe(false);
		expect(options.map((o) => o.interval.from.id)).toEqual([withReset.id, a.id]);
		const last = options[0];
		expect(last.previous).toBeNull();
	});

	it('uses the cumulative values before the period as the career baseline', () => {
		const [latest] = buildPeriodOptions([a, b, c]);
		expect(baselineValues(latest, 'career')).toMatchObject({ kills: 1600, missionsPlayed: 70 });
		expect(baselineValues(latest, 'previous')).toMatchObject({ kills: 600, missionsPlayed: 20 });
	});

	it('has no previous baseline for the first interval', () => {
		const options = buildPeriodOptions([a, b, c]);
		expect(baselineValues(options[1], 'previous')).toBeNull();
	});
});
