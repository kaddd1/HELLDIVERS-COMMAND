import { describe, expect, it } from 'vitest';
import type { StatValues } from '../domain/statDefinitions.ts';
import { buildPortrait, type Fact } from './portrait.ts';

/** Values from a real career screen (the same numbers the OCR tests use). */
const REAL: StatValues = {
	kills: 40002,
	killsBugs: 17571,
	killsAutomatons: 14083,
	killsIlluminate: 8348,
	friendlyKills: 94,
	grenadeKills: 1230,
	meleeKills: 83,
	eagleKills: 5852,
	deaths: 886,
	shotsFired: 230523,
	shotsHit: 137458,
	orbitalStratagems: 620,
	defensiveStratagems: 626,
	eagleStratagems: 1531,
	supplyStratagems: 893,
	reinforcementStratagems: 819,
	stratagemsUsed: 4799,
	successfulExtractions: 237,
	objectivesCompleted: 1392,
	missionsPlayed: 281,
	missionsCompleted: 262,
	timeInMissions: 345268,
	samplesCollected: 4075,
	totalXp: 394150
};

const fact = <K extends Fact['kind']>(facts: Fact[], kind: K) =>
	facts.find((f) => f.kind === kind) as Extract<Fact, { kind: K }> | undefined;

describe('buildPortrait for a full career', () => {
	const portrait = buildPortrait(REAL);

	it('computes natural shares', () => {
		expect(portrait.accuracy).toBeCloseTo(0.5963, 3);
		expect(portrait.success).toBeCloseTo(0.9324, 3);
		expect(portrait.extraction).toBeCloseTo(0.8434, 3);
	});

	it('computes career averages', () => {
		expect(portrait.kd).toBeCloseTo(45.15, 2);
		expect(portrait.killsPerMission).toBeCloseTo(142.36, 2);
		expect(portrait.deathsPerMission).toBeCloseTo(3.15, 2);
		expect(portrait.minutesPerMission).toBeCloseTo(20.48, 2);
		expect(portrait.killsPerMinute).toBeCloseTo(6.95, 2);
		expect(portrait.reliable).toBe(true);
	});

	it('finds the favourite faction and says whether the split is even', () => {
		const favorite = fact(portrait.facts, 'favoriteFaction')!;
		expect(favorite.part).toBe('bugs');
		expect(favorite.share).toBeCloseTo(0.439, 3);
		expect(favorite.even).toBe(false);
	});

	it('describes the leading kill method as one in N kills', () => {
		expect(fact(portrait.facts, 'methodShare')).toEqual({
			kind: 'methodShare',
			part: 'eagle',
			oneIn: 7
		});
	});

	it('describes failed missions as one in N', () => {
		expect(fact(portrait.facts, 'failedMissions')).toEqual({
			kind: 'failedMissions',
			oneIn: 15,
			failed: 19
		});
	});

	it('describes friendly fire as one in N kills', () => {
		expect(fact(portrait.facts, 'friendlyFire')).toEqual({
			kind: 'friendlyFire',
			oneIn: 426,
			count: 94
		});
	});

	it('describes stratagem use and the favourite category', () => {
		const stratagems = fact(portrait.facts, 'stratagems')!;
		expect(stratagems.perMission).toBeCloseTo(17.08, 2);
		expect(stratagems.favorite).toBe('eagle');
	});

	it('builds the three compositions', () => {
		expect(portrait.compositions.map((c) => c.id)).toEqual(['factions', 'methods', 'stratagems']);
	});
});

describe('buildPortrait with missing or small data', () => {
	it('does not invent anything from an empty bag', () => {
		const portrait = buildPortrait({});
		expect(portrait.facts).toEqual([]);
		expect(portrait.accuracy).toBeNull();
		expect(portrait.kd).toBeNull();
		expect(portrait.compositions).toEqual([]);
		expect(portrait.reliable).toBe(false);
	});

	it('flags a short career as unreliable but still reports the numbers', () => {
		const portrait = buildPortrait({
			kills: 90,
			deaths: 9,
			missionsPlayed: 3,
			missionsCompleted: 3
		});
		expect(portrait.reliable).toBe(false);
		expect(portrait.kd).toBe(10);
		expect(fact(portrait.facts, 'allMissionsCompleted')).toBeDefined();
	});

	it('skips accuracy and K/D when their denominators are zero', () => {
		const portrait = buildPortrait({
			kills: 100,
			deaths: 0,
			shotsFired: 0,
			shotsHit: 0,
			missionsPlayed: 10
		});
		expect(portrait.kd).toBeNull();
		expect(portrait.accuracy).toBeNull();
		expect(fact(portrait.facts, 'killsPerDeath')).toBeUndefined();
	});

	it('does not draw an impossible evacuation share', () => {
		expect(buildPortrait({ successfulExtractions: 30, missionsPlayed: 10 }).extraction).toBeNull();
	});

	it('reports no friendly fire when there was none', () => {
		const portrait = buildPortrait({ kills: 500, friendlyKills: 0 });
		expect(fact(portrait.facts, 'noFriendlyFire')).toBeDefined();
	});

	it('calls evenly split factions even', () => {
		const portrait = buildPortrait({
			kills: 1000,
			killsBugs: 350,
			killsAutomatons: 330,
			killsIlluminate: 320
		});
		expect(fact(portrait.facts, 'favoriteFaction')!.even).toBe(true);
	});

	it('leaves out a kill method that is negligible', () => {
		const portrait = buildPortrait({
			kills: 10000,
			grenadeKills: 20,
			meleeKills: 5,
			eagleKills: 10
		});
		expect(fact(portrait.facts, 'methodShare')).toBeUndefined();
	});
});
