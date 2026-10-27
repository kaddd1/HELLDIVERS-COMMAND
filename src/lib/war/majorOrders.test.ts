import { describe, expect, it } from 'vitest';
import {
	counterShare,
	normalizeAssignments,
	orderState,
	remainingTime,
	type MajorOrder
} from './majorOrders.ts';
import { LIVE_ASSIGNMENTS } from './fixtures.ts';

describe('normalizeAssignments with a real API response', () => {
	const [order] = normalizeAssignments(LIVE_ASSIGNMENTS);

	it('keeps the official text as is', () => {
		expect(order.id).toBe(568917260);
		expect(order.title).toBe('ГЛАВНЫЙ ПРИКАЗ');
		expect(order.briefing).toContain('Демократичный снайпер');
		expect(order.description).toBeNull();
	});

	it('reads the goal and progress of each eradication task', () => {
		expect(order.tasks.map((t) => t.counter)).toEqual([
			{ current: 56859176, goal: 300000000 },
			{ current: 16583750, goal: 65000000 },
			{ current: 50000000, goal: 50000000 }
		]);
		expect(order.tasks.every((t) => t.kind === 'eradicate')).toBe(true);
	});

	it('reads the target faction', () => {
		expect(order.tasks.map((t) => t.faction)).toEqual(['terminids', 'illuminate', 'automatons']);
	});

	it('reads the reward and the expiration', () => {
		expect(order.rewards).toEqual([{ type: 1, amount: 45 }]);
		expect(order.expiresAt).toBe('2026-10-29T10:54:12.382Z');
	});

	it('is still active while only some tasks are complete', () => {
		const before = new Date('2026-10-27T12:00:00Z').getTime();
		expect(orderState(order, before)).toBe('active');
	});

	it('shares of the goal', () => {
		expect(counterShare(order.tasks[0].counter!)).toBeCloseTo(0.1895, 3);
		expect(counterShare(order.tasks[2].counter!)).toBe(1);
	});
});

describe('normalizeAssignments with unusual input', () => {
	it('returns nothing for non-lists and empty lists', () => {
		expect(normalizeAssignments(null)).toEqual([]);
		expect(normalizeAssignments({})).toEqual([]);
		expect(normalizeAssignments([])).toEqual([]);
	});

	it('drops entries without a numeric id', () => {
		expect(normalizeAssignments([{ title: 'x' }, 'text', null])).toEqual([]);
	});

	it('does not invent a counter for task types whose progress is not confirmed', () => {
		const [order] = normalizeAssignments([
			{
				id: 1,
				progress: [1],
				tasks: [{ type: 11, values: [1, 1, 1], valueTypes: [1, 2, 3] }]
			}
		]);
		expect(order.tasks[0]).toMatchObject({ kind: 'liberate', counter: null });
	});

	it('keeps unknown task types visible without a counter', () => {
		const [order] = normalizeAssignments([
			{ id: 1, progress: [5], tasks: [{ type: 99, values: [], valueTypes: [] }] }
		]);
		expect(order.tasks[0]).toMatchObject({ type: 99, kind: 'unknown', counter: null });
	});

	it('shows no counter when progress and tasks do not line up', () => {
		const [order] = normalizeAssignments([
			{
				id: 1,
				progress: [1, 2, 3],
				tasks: [{ type: 3, values: [2, 0, 100], valueTypes: [1, 2, 3] }]
			}
		]);
		expect(order.tasks[0].counter).toBeNull();
	});

	it('shows no counter without a goal or with a zero goal', () => {
		const [order] = normalizeAssignments([
			{
				id: 1,
				progress: [5, 5],
				tasks: [
					{ type: 3, values: [2, 0], valueTypes: [1, 2] },
					{ type: 3, values: [2, 0, 0], valueTypes: [1, 2, 3] }
				]
			}
		]);
		expect(order.tasks.map((t) => t.counter)).toEqual([null, null]);
	});

	it('treats a faction code of zero as any enemy and an unknown code as unknown', () => {
		const make = (race: number) =>
			normalizeAssignments([
				{ id: 1, progress: [1], tasks: [{ type: 3, values: [race, 0, 10], valueTypes: [1, 2, 3] }] }
			])[0].tasks[0].faction;
		expect(make(0)).toBe('any');
		expect(make(77)).toBeNull();
	});

	it('falls back to the single reward field and ignores empty rewards', () => {
		const [a] = normalizeAssignments([{ id: 1, reward: { type: 1, amount: 20 } }]);
		expect(a.rewards).toEqual([{ type: 1, amount: 20 }]);
		const [b] = normalizeAssignments([{ id: 2, rewards: [{ type: 1, amount: 0 }, 'x'] }]);
		expect(b.rewards).toEqual([]);
	});

	it('treats an invalid expiration as missing', () => {
		const [order] = normalizeAssignments([{ id: 1, expiration: 'soon' }]);
		expect(order.expiresAt).toBeNull();
	});

	it('turns blank text into null', () => {
		const [order] = normalizeAssignments([{ id: 1, title: '  ', briefing: '', description: 5 }]);
		expect(order.title).toBeNull();
		expect(order.briefing).toBeNull();
		expect(order.description).toBeNull();
	});
});

describe('orderState', () => {
	function orderWith(counters: [number, number][], expiresAt: string | null): MajorOrder {
		return {
			id: 1,
			title: null,
			briefing: null,
			description: null,
			expiresAt,
			rewards: [],
			tasks: counters.map(([current, goal]) => ({
				type: 3,
				kind: 'eradicate' as const,
				faction: null,
				counter: { current, goal }
			}))
		};
	}
	const now = new Date('2026-01-01T00:00:00Z').getTime();

	it('is completed when every measured task reached its goal', () => {
		expect(
			orderState(
				orderWith(
					[
						[10, 10],
						[5, 5]
					],
					null
				),
				now
			)
		).toBe('completed');
	});

	it('is expired after the deadline, even if tasks are unfinished', () => {
		expect(orderState(orderWith([[1, 10]], '2025-12-31T00:00:00Z'), now)).toBe('expired');
	});

	it('is not completed when some task cannot be measured', () => {
		const order = orderWith([[10, 10]], null);
		order.tasks.push({ type: 11, kind: 'liberate', faction: null, counter: null });
		expect(orderState(order, now)).toBe('active');
	});

	it('is not completed without tasks', () => {
		expect(orderState(orderWith([], null), now)).toBe('active');
	});
});

describe('remainingTime', () => {
	const now = new Date('2026-10-27T10:00:00Z').getTime();

	it('splits the time left into days, hours, minutes and seconds', () => {
		const result = remainingTime('2026-10-29T11:02:03Z', now);
		expect(result).toMatchObject({ days: 2, hours: 1, minutes: 2, seconds: 3 });
	});

	it('never goes negative', () => {
		expect(remainingTime('2026-10-01T00:00:00Z', now)).toMatchObject({ days: 0, totalMs: 0 });
	});

	it('has no countdown without an expiration', () => {
		expect(remainingTime(null, now)).toBeNull();
	});

	it('counts down second by second', () => {
		const a = remainingTime('2026-10-27T10:01:00Z', now)!;
		const b = remainingTime('2026-10-27T10:01:00Z', now + 1000)!;
		expect(a.seconds).toBe(0);
		expect(a.minutes).toBe(1);
		expect(b.minutes).toBe(0);
		expect(b.seconds).toBe(59);
	});
});
