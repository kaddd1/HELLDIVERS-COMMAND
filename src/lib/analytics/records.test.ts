import { describe, expect, it } from 'vitest';
import { makeSnapshot } from '../domain/testing.ts';
import { computeRecords } from './records.ts';

const find = (records: ReturnType<typeof computeRecords>, id: string) =>
	records.find((r) => r.id === id);

describe('computeRecords', () => {
	it('has no records for a single snapshot', () => {
		expect(computeRecords([makeSnapshot(0)])).toEqual([]);
	});

	it('finds the largest change between snapshots', () => {
		const records = computeRecords([
			makeSnapshot(0, { kills: 1000 }),
			makeSnapshot(7, { kills: 1300 }),
			makeSnapshot(14, { kills: 2300 })
		]);
		const most = find(records, 'mostKills');
		expect(most?.value).toBe(1000);
		expect(most?.from?.stats.kills).toBe(1300);
		expect(most?.to.stats.kills).toBe(2300);
	});

	it('requires enough volume for ratio records', () => {
		const tiny = computeRecords([
			makeSnapshot(0, { kills: 1000, deaths: 100 }),
			makeSnapshot(1, { kills: 1050, deaths: 101 })
		]);
		expect(find(tiny, 'bestKd')).toBeUndefined();

		const enough = computeRecords([
			makeSnapshot(0, { kills: 1000, deaths: 100 }),
			makeSnapshot(1, { kills: 1100, deaths: 110 })
		]);
		expect(find(enough, 'bestKd')?.value).toBe(10);
	});

	it('does not use intervals with resets or anomalies', () => {
		const records = computeRecords([
			makeSnapshot(0, { kills: 5000 }),
			makeSnapshot(1, { kills: 200 }, { resetConfirmed: true }),
			makeSnapshot(2, { kills: 300 })
		]);
		expect(find(records, 'mostKills')?.value).toBe(100);
	});

	it('does not record an interval where nothing happened', () => {
		const records = computeRecords([makeSnapshot(0), makeSnapshot(1)]);
		expect(find(records, 'mostKills')).toBeUndefined();
	});

	it('records the peak cumulative K/D with the snapshot it occurred at', () => {
		const records = computeRecords([
			makeSnapshot(0, { kills: 1000, deaths: 100 }),
			makeSnapshot(1, { kills: 1500, deaths: 100 }),
			makeSnapshot(2, { kills: 1600, deaths: 200 })
		]);
		const peak = find(records, 'peakKd');
		expect(peak?.value).toBe(15);
		expect(peak?.from).toBeNull();
	});

	it('records accuracy only with enough shots', () => {
		const records = computeRecords([
			makeSnapshot(0, { shotsFired: 1000, shotsHit: 500 }),
			makeSnapshot(1, { shotsFired: 3000, shotsHit: 1700 })
		]);
		expect(find(records, 'bestAccuracy')?.value).toBeCloseTo(0.6, 5);
	});
});
