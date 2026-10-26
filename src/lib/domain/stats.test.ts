import { describe, expect, it } from 'vitest';
import {
	accuracy,
	kdRatio,
	killsPerHour,
	killShare,
	getStatValue,
	successRate,
	type PlayerStats
} from './stats.ts';

function makeStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
	return {
		level: 1,
		rankTitle: 'Test',
		kills: 100,
		deaths: 25,
		missionsPlayed: 10,
		missionsCompleted: 8,
		shotsFired: 200,
		shotsHit: 50,
		timePlayedSeconds: 7200,
		extra: {},
		...overrides
	};
}

describe('stats calculations', () => {
	it('computes K/D', () => {
		expect(kdRatio(makeStats())).toBe(4);
	});

	it('returns null K/D when there are no deaths', () => {
		expect(kdRatio(makeStats({ deaths: 0 }))).toBeNull();
	});

	it('computes mission success rate', () => {
		expect(successRate(makeStats())).toBe(0.8);
		expect(successRate(makeStats({ missionsPlayed: 0, missionsCompleted: 0 }))).toBeNull();
	});

	it('computes accuracy only when shot data exists', () => {
		expect(accuracy(makeStats())).toBe(0.25);
		expect(accuracy(makeStats({ shotsFired: null, shotsHit: null }))).toBeNull();
		expect(accuracy(makeStats({ shotsFired: 0, shotsHit: 0 }))).toBeNull();
	});

	it('computes kills per hour', () => {
		expect(killsPerHour(makeStats())).toBe(50);
		expect(killsPerHour(makeStats({ timePlayedSeconds: null }))).toBeNull();
	});

	it('reads any statistic by key', () => {
		const stats = makeStats({ extra: { totalXp: 500 } });
		expect(getStatValue(stats, 'kills')).toBe(100);
		expect(getStatValue(stats, 'timeInMissions')).toBe(7200);
		expect(getStatValue(stats, 'totalXp')).toBe(500);
		expect(getStatValue(stats, 'killsBugs')).toBeNull();
	});

	it('computes kill share', () => {
		expect(killShare(makeStats())).toBe(0.8);
		expect(killShare(makeStats({ kills: 0, deaths: 0 }))).toBeNull();
	});
});
