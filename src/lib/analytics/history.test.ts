import { describe, expect, it } from 'vitest';
import { makeSnapshot } from '../domain/testing.ts';
import {
	activeSnapshots,
	buildIntervalSeries,
	buildIntervals,
	buildSeries,
	compareInHistory,
	compareSnapshots,
	filterRange,
	findAnomalies,
	previewInsertion,
	sortSnapshots
} from './history.ts';

describe('sorting', () => {
	it('orders snapshots by statistics date, not by import order', () => {
		const late = makeSnapshot(10);
		const early = makeSnapshot(1);
		expect(sortSnapshots([late, early]).map((s) => s.id)).toEqual([early.id, late.id]);
	});

	it('leaves excluded snapshots out of the active history', () => {
		const a = makeSnapshot(1);
		const b = makeSnapshot(2, {}, { excluded: true });
		expect(activeSnapshots([a, b])).toEqual([a]);
	});
});

describe('compareSnapshots', () => {
	it('computes differences of cumulative counters', () => {
		const from = makeSnapshot(0, {
			kills: 1000,
			deaths: 100,
			missionsPlayed: 50,
			missionsCompleted: 45
		});
		const to = makeSnapshot(7, {
			kills: 1500,
			deaths: 130,
			missionsPlayed: 60,
			missionsCompleted: 54
		});
		const interval = compareSnapshots(from, to);
		expect(interval.status).toBe('ok');
		expect(interval.deltas).toMatchObject({
			kills: 500,
			deaths: 30,
			missionsPlayed: 10,
			missionsCompleted: 9
		});
		expect(interval.seconds).toBe(7 * 86400);
	});

	it('reports zero change when nothing changed', () => {
		const interval = compareSnapshots(makeSnapshot(0), makeSnapshot(1));
		expect(interval.status).toBe('ok');
		expect(interval.deltas.kills).toBe(0);
	});

	it.each(['kills', 'deaths', 'missionsPlayed', 'missionsCompleted'] as const)(
		'flags a lower %s counter as an anomaly without computing negative progress',
		(key) => {
			const from = makeSnapshot(0);
			const to = makeSnapshot(1, { [key]: from.stats[key] - 1 });
			const interval = compareSnapshots(from, to);
			expect(interval.status).toBe('anomaly');
			expect(interval.decreased).toEqual([key]);
			expect(interval.deltas).toEqual({});
		}
	);

	it('does not treat a confirmed reset as progress', () => {
		const from = makeSnapshot(0, { kills: 5000 });
		const to = makeSnapshot(1, { kills: 100 }, { resetConfirmed: true });
		const interval = compareSnapshots(from, to);
		expect(interval.status).toBe('reset');
		expect(interval.deltas).toEqual({});
	});

	it('leaves out a non-counter statistic that shrank instead of showing it as negative', () => {
		const from = makeSnapshot(0, { shotsFired: 10000 });
		const to = makeSnapshot(1, { shotsFired: 9000, kills: 1100 });
		const interval = compareSnapshots(from, to);
		expect(interval.status).toBe('ok');
		expect(interval.deltas.shotsFired).toBeUndefined();
		expect(interval.deltas.kills).toBe(100);
	});

	it('skips statistics that are missing in either snapshot', () => {
		const from = makeSnapshot(0, { shotsFired: null, shotsHit: null });
		const to = makeSnapshot(1, { shotsFired: 500, shotsHit: 100 });
		expect(compareSnapshots(from, to).deltas.shotsFired).toBeUndefined();
	});

	it('works with extra statistics', () => {
		const from = makeSnapshot(0, { extra: { totalXp: 100 } });
		const to = makeSnapshot(1, { extra: { totalXp: 250 } });
		expect(compareSnapshots(from, to).deltas.totalXp).toBe(150);
	});
});

describe('history with resets', () => {
	const a = makeSnapshot(0, { kills: 1000 });
	const b = makeSnapshot(7, { kills: 2000 });
	const c = makeSnapshot(14, { kills: 50 }, { resetConfirmed: true });
	const d = makeSnapshot(21, { kills: 400 });

	it('marks only the interval around the reset', () => {
		const statuses = buildIntervals([a, b, c, d]).map((i) => i.status);
		expect(statuses).toEqual(['ok', 'reset', 'ok']);
	});

	it('treats a comparison across a reset as a reset', () => {
		expect(compareInHistory([a, b, c, d], a, d).status).toBe('reset');
		expect(compareInHistory([a, b, c, d], c, d).status).toBe('ok');
	});

	it('compares in either order of arguments', () => {
		expect(compareInHistory([a, b], b, a).deltas.kills).toBe(1000);
	});

	it('lists unresolved anomalies', () => {
		const bad = makeSnapshot(15, { kills: 10 });
		const intervals = buildIntervals([a, b, bad]);
		expect(findAnomalies(intervals)).toHaveLength(1);
	});
});

describe('previewInsertion', () => {
	it('detects an anomaly with the previous and the next snapshot', () => {
		const first = makeSnapshot(0, { kills: 1000 });
		const last = makeSnapshot(20, { kills: 2000 });
		const candidate = makeSnapshot(10, { kills: 1500 });
		expect(previewInsertion([first, last], candidate).before?.status).toBe('ok');

		const tooLow = makeSnapshot(10, { kills: 500 });
		expect(previewInsertion([first, last], tooLow).before?.status).toBe('anomaly');

		const tooHigh = makeSnapshot(10, { kills: 2500 });
		expect(previewInsertion([first, last], tooHigh).after?.status).toBe('anomaly');
	});

	it('has no neighbours for the first snapshot', () => {
		expect(previewInsertion([], makeSnapshot(0))).toEqual({ before: null, after: null });
	});
});

describe('filterRange', () => {
	const snapshots = [0, 20, 80, 100].map((day) => makeSnapshot(day));

	it('counts back from the newest snapshot', () => {
		expect(filterRange(snapshots, '30')).toHaveLength(2);
		expect(filterRange(snapshots, '90')).toHaveLength(3);
		expect(filterRange(snapshots, '7')).toHaveLength(1);
		expect(filterRange(snapshots, 'all')).toHaveLength(4);
	});

	it('returns nothing for no snapshots', () => {
		expect(filterRange([], '30')).toEqual([]);
	});
});

describe('buildSeries', () => {
	it('connects consistent snapshots', () => {
		const series = buildSeries([makeSnapshot(0), makeSnapshot(1)], (s) => s.stats.kills);
		expect(series.points).toHaveLength(2);
		expect(series.breaks).toEqual([]);
	});

	it('cuts the line at a confirmed reset', () => {
		const snapshots = [
			makeSnapshot(0, { kills: 1000 }),
			makeSnapshot(2, { kills: 50 }, { resetConfirmed: true })
		];
		const series = buildSeries(snapshots, (s) => s.stats.kills);
		expect(series.points.map((p) => p[1])).toEqual([1000, null, 50]);
		expect(series.breaks).toEqual([
			{ t: new Date(snapshots[1].capturedAt).getTime(), status: 'reset' }
		]);
	});

	it('cuts the line at an unresolved anomaly', () => {
		const series = buildSeries(
			[makeSnapshot(0, { kills: 1000 }), makeSnapshot(2, { kills: 50 })],
			(s) => s.stats.kills
		);
		expect(series.breaks[0].status).toBe('anomaly');
		expect(series.points[1][1]).toBeNull();
	});

	it('keeps missing values as gaps', () => {
		const series = buildSeries([makeSnapshot(0, { shotsFired: null })], (s) => s.stats.shotsFired);
		expect(series.points[0][1]).toBeNull();
	});
});

describe('buildIntervalSeries', () => {
	it('gives no value for intervals that are not ok', () => {
		const snapshots = [
			makeSnapshot(0, { kills: 1000 }),
			makeSnapshot(1, { kills: 1100 }),
			makeSnapshot(2, { kills: 10 })
		];
		const points = buildIntervalSeries(buildIntervals(snapshots), (i) => i.deltas.kills ?? null);
		expect(points.map((p) => p.value)).toEqual([100, null]);
	});
});
