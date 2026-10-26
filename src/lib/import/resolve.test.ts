import { describe, expect, it } from 'vitest';
import { statsEqual } from '../domain/stats.ts';
import { parseEditedValue } from './edit.ts';
import { mergeAnalyses } from './merge.ts';
import {
	buildPlayerStats,
	resolveStats,
	toValues,
	validateValues,
	type Decisions,
	type StatValues
} from './resolve.ts';
import type { Observation, ScreenshotAnalysis } from './types.ts';

const NO_DECISIONS: Decisions = { values: {}, confirmed: [] };

/** Two agreeing passes for each value, as for a cleanly recognized screenshot. */
function analysisOf(values: StatValues, confidence = 92): ScreenshotAnalysis {
	const observations: Observation[] = Object.entries(values).flatMap(([key, value]) =>
		['a', 'b'].map((pass) => ({
			key: key as Observation['key'],
			value,
			confidence,
			screenshot: 0,
			pass
		}))
	);
	return { observations, names: [], matchedRows: observations.length, unmatchedLabels: [] };
}

const FULL: StatValues = {
	level: 86,
	kills: 40002,
	killsBugs: 17571,
	killsAutomatons: 14083,
	killsIlluminate: 8348,
	deaths: 886,
	shotsFired: 230523,
	shotsHit: 137458,
	stratagemsUsed: 4799,
	orbitalStratagems: 620,
	defensiveStratagems: 626,
	eagleStratagems: 1531,
	supplyStratagems: 893,
	reinforcementStratagems: 819,
	missionsPlayed: 281,
	missionsCompleted: 262,
	timeInMissions: 345268
};

function resolveFrom(values: StatValues, decisions: Decisions = NO_DECISIONS) {
	return resolveStats(mergeAnalyses([analysisOf(values)]).stats, decisions);
}

describe('validateValues', () => {
	it('accepts consistent values', () => {
		expect(validateValues(FULL)).toEqual([]);
	});

	it('detects more completed missions than played', () => {
		const issues = validateValues({ ...FULL, missionsCompleted: 300 });
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ code: 'completedExceedsPlayed', severity: 'error' });
	});

	it('detects more hits than shots', () => {
		const issues = validateValues({ ...FULL, shotsHit: 999999 });
		expect(issues.map((i) => i.code)).toEqual(['hitsExceedShots']);
	});

	it('flags faction kills that do not add up to the total as a warning', () => {
		const issues = validateValues({ ...FULL, killsAutomatons: 14085 });
		expect(issues).toHaveLength(1);
		expect(issues[0]).toMatchObject({ code: 'factionKillsMismatch', severity: 'warning' });
		expect(issues[0].params).toEqual({ sum: 40004, kills: 40002 });
	});

	it('detects a category larger than all kills', () => {
		const issues = validateValues({ ...FULL, grenadeKills: 50000 });
		expect(issues.map((i) => i.code)).toContain('subKillsExceedKills');
	});

	it('detects stratagem categories that exceed the total', () => {
		const issues = validateValues({ ...FULL, stratagemsUsed: 100 });
		expect(issues.map((i) => i.code)).toEqual(['stratagemsExceedTotal']);
	});

	it('does not run checks for values that are not known', () => {
		expect(validateValues({ kills: 5 })).toEqual([]);
	});

	it('rejects an impossible level', () => {
		expect(validateValues({ level: 0 }).map((i) => i.code)).toEqual(['levelOutOfRange']);
	});
});

describe('resolveStats', () => {
	it('leaves clean readings as ok and non-blocking', () => {
		const resolved = resolveFrom({ kills: 5, deaths: 2 });
		expect(resolved.find((s) => s.key === 'kills')).toMatchObject({ state: 'ok', blocking: false });
	});

	it('blocks on conflicts until the user chooses', () => {
		const analysis = analysisOf({ kills: 5 });
		analysis.observations.push({
			key: 'kills',
			value: 6,
			confidence: 90,
			screenshot: 1,
			pass: 'a'
		});
		const merged = mergeAnalyses([analysis]).stats;

		const before = resolveStats(merged, NO_DECISIONS).find((s) => s.key === 'kills');
		expect(before).toMatchObject({ state: 'conflict', blocking: true, value: null });

		const after = resolveStats(merged, {
			values: { kills: { value: 6, origin: 'chosen' } },
			confirmed: []
		}).find((s) => s.key === 'kills');
		expect(after).toMatchObject({ state: 'chosen', blocking: false, value: 6 });
	});

	it('blocks uncertain readings until they are confirmed', () => {
		const analysis: ScreenshotAnalysis = {
			observations: [{ key: 'deaths', value: 886, confidence: 50, screenshot: 0, pass: 'a' }],
			names: [],
			matchedRows: 1,
			unmatchedLabels: []
		};
		const merged = mergeAnalyses([analysis]).stats;
		expect(resolveStats(merged, NO_DECISIONS).find((s) => s.key === 'deaths')?.blocking).toBe(true);
		const confirmed = resolveStats(merged, { values: {}, confirmed: ['deaths'] }).find(
			(s) => s.key === 'deaths'
		);
		expect(confirmed).toMatchObject({ state: 'confirmed', blocking: false, value: 886 });
	});

	it('blocks on missing required statistics but not on missing optional ones', () => {
		const resolved = resolveFrom({ kills: 5 });
		expect(resolved.find((s) => s.key === 'deaths')?.blocking).toBe(true);
		expect(resolved.find((s) => s.key === 'totalXp')?.blocking).toBe(false);
	});

	it('lets an edit override a recognized value', () => {
		const resolved = resolveFrom(
			{ kills: 5 },
			{ values: { kills: { value: 7, origin: 'edited' } }, confirmed: [] }
		);
		expect(resolved.find((s) => s.key === 'kills')).toMatchObject({ state: 'edited', value: 7 });
	});
});

describe('buildPlayerStats', () => {
	it('builds a snapshot from complete values', () => {
		const stats = buildPlayerStats(toValues(resolveFrom(FULL)));
		expect(stats).toMatchObject({
			level: 86,
			kills: 40002,
			deaths: 886,
			missionsPlayed: 281,
			missionsCompleted: 262,
			shotsFired: 230523,
			shotsHit: 137458,
			timePlayedSeconds: 345268,
			rankTitle: null
		});
		expect(stats?.extra).toMatchObject({ killsBugs: 17571, stratagemsUsed: 4799 });
	});

	it('refuses to build when a required statistic is unknown', () => {
		const withoutDeaths: StatValues = { ...FULL };
		delete withoutDeaths.deaths;
		expect(buildPlayerStats(toValues(resolveFrom(withoutDeaths)))).toBeNull();
	});

	it('keeps unknown optional statistics out instead of inventing zeros', () => {
		const stats = buildPlayerStats({
			level: 1,
			kills: 1,
			deaths: 1,
			missionsPlayed: 1,
			missionsCompleted: 1
		});
		expect(stats?.shotsFired).toBeNull();
		expect(stats?.timePlayedSeconds).toBeNull();
		expect(stats?.extra).toEqual({});
	});
});

describe('duplicate detection', () => {
	const base = () => buildPlayerStats(FULL) as NonNullable<ReturnType<typeof buildPlayerStats>>;

	it('treats identical stats as equal', () => {
		expect(statsEqual(base(), base())).toBe(true);
	});

	it('detects a difference in a core value', () => {
		expect(statsEqual(base(), { ...base(), kills: 40003 })).toBe(false);
	});

	it('detects a difference in an extra value', () => {
		const changed = { ...base(), extra: { ...base().extra, killsBugs: 17572 } };
		expect(statsEqual(base(), changed)).toBe(false);
	});

	it('detects an extra value that appeared or disappeared', () => {
		const without = { ...base(), extra: {} };
		expect(statsEqual(base(), without)).toBe(false);
	});
});

describe('parseEditedValue', () => {
	it('accepts plain numbers and numbers with separators', () => {
		expect(parseEditedValue('kills', '40002')).toBe(40002);
		expect(parseEditedValue('kills', '40 002')).toBe(40002);
		expect(parseEditedValue('kills', '40 002')).toBe(40002);
	});

	it('accepts h:mm:ss for durations only', () => {
		expect(parseEditedValue('timeInMissions', '95:54:28')).toBe(345268);
		expect(parseEditedValue('timeInMissions', '345268')).toBeNull();
		expect(parseEditedValue('kills', '1:00:00')).toBeNull();
	});

	it('rejects empty, negative and non-numeric input', () => {
		expect(parseEditedValue('kills', '')).toBeNull();
		expect(parseEditedValue('kills', '-5')).toBeNull();
		expect(parseEditedValue('kills', '12a')).toBeNull();
	});
});
