import { describe, expect, it } from 'vitest';
import { getRatio } from './metrics.ts';

describe('ratios', () => {
	it('computes K/D', () => {
		expect(getRatio('kd').compute({ kills: 40002, deaths: 886 })).toBeCloseTo(45.15, 2);
	});

	it('returns null instead of dividing by zero', () => {
		expect(getRatio('kd').compute({ kills: 10, deaths: 0 })).toBeNull();
		expect(getRatio('success').compute({ missionsCompleted: 0, missionsPlayed: 0 })).toBeNull();
		expect(getRatio('accuracy').compute({ shotsHit: 0, shotsFired: 0 })).toBeNull();
	});

	it('returns null when an input statistic is unknown', () => {
		expect(getRatio('kd').compute({ kills: 10 })).toBeNull();
		expect(getRatio('accuracy').compute({ shotsFired: 100 })).toBeNull();
		expect(getRatio('killsPerHour').compute({ kills: 100 })).toBeNull();
	});

	it('computes mission success as a share', () => {
		expect(
			getRatio('success').compute({ missionsCompleted: 262, missionsPlayed: 281 })
		).toBeCloseTo(0.9324, 3);
	});

	it('computes accuracy as a share', () => {
		expect(getRatio('accuracy').compute({ shotsHit: 137458, shotsFired: 230523 })).toBeCloseTo(
			0.5963,
			3
		);
	});

	it('computes per-mission and per-hour values', () => {
		expect(getRatio('killsPerMission').compute({ kills: 100, missionsPlayed: 4 })).toBe(25);
		expect(getRatio('killsPerHour').compute({ kills: 300, timeInMissions: 7200 })).toBe(150);
		expect(getRatio('xpPerMission').compute({ totalXp: 1000, missionsPlayed: 10 })).toBe(100);
	});

	it('scales friendly fire to 1000 kills', () => {
		expect(
			getRatio('friendlyFirePer1000').compute({ friendlyKills: 94, kills: 40002 })
		).toBeCloseTo(2.35, 2);
	});

	it('works on interval differences the same way', () => {
		expect(getRatio('kd').compute({ kills: 500, deaths: 25 })).toBe(20);
	});
});
