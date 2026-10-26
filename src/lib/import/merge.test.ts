import { describe, expect, it } from 'vitest';
import { checkScreenshots, mergeAnalyses } from './merge.ts';
import type { Observation, ScreenshotAnalysis } from './types.ts';

function observation(
	key: Observation['key'],
	value: number,
	screenshot: number,
	pass = 'a',
	confidence = 92
): Observation {
	return { key, value, confidence, screenshot, pass };
}

function analysis(
	observations: Observation[],
	matchedRows = observations.length
): ScreenshotAnalysis {
	return { observations, names: [], matchedRows, unmatchedLabels: [] };
}

function find(result: ReturnType<typeof mergeAnalyses>, key: string) {
	const stat = result.stats.find((s) => s.key === key);
	if (!stat) throw new Error(`no ${key}`);
	return stat;
}

describe('mergeAnalyses', () => {
	it('marks a value read consistently by two passes as ok', () => {
		const merged = mergeAnalyses([
			analysis([observation('kills', 40002, 0, 'a'), observation('kills', 40002, 0, 'b')])
		]);
		expect(find(merged, 'kills')).toMatchObject({ status: 'ok', value: 40002 });
	});

	it('combines statistics that appear on only one screenshot', () => {
		const merged = mergeAnalyses([
			analysis([observation('kills', 40002, 0)]),
			analysis([observation('missionsPlayed', 281, 1)])
		]);
		expect(find(merged, 'kills').screenshots).toEqual([0]);
		expect(find(merged, 'missionsPlayed').screenshots).toEqual([1]);
	});

	it('treats the same value on both screenshots as one duplicate reading', () => {
		const merged = mergeAnalyses([
			analysis([observation('shotsHit', 137458, 0)]),
			analysis([observation('shotsHit', 137458, 1)])
		]);
		const stat = find(merged, 'shotsHit');
		expect(stat.status).toBe('ok');
		expect(stat.candidates).toEqual([{ value: 137458, votes: 2, confidence: 92 }]);
		expect(stat.screenshots).toEqual([0, 1]);
	});

	it('reports a conflict instead of choosing between different values', () => {
		const merged = mergeAnalyses([
			analysis([observation('eagleStratagems', 1531, 0)]),
			analysis([observation('eagleStratagems', 1551, 1, 'a', 99)])
		]);
		const stat = find(merged, 'eagleStratagems');
		expect(stat.status).toBe('conflict');
		expect(stat.value).toBeNull();
		expect(stat.candidates.map((c) => c.value).sort()).toEqual([1531, 1551]);
	});

	it('does not let a more confident reading win silently over a majority', () => {
		const merged = mergeAnalyses([
			analysis([
				observation('totalXp', 394150, 0, 'a', 70),
				observation('totalXp', 394150, 0, 'b', 70),
				observation('totalXp', 594150, 0, 'c', 99)
			])
		]);
		expect(find(merged, 'totalXp').status).toBe('conflict');
	});

	it('asks for confirmation when a single reading has low confidence', () => {
		const merged = mergeAnalyses([analysis([observation('deaths', 886, 0, 'a', 52)])]);
		expect(find(merged, 'deaths')).toMatchObject({ status: 'uncertain', value: 886 });
	});

	it('accepts a single high-confidence reading', () => {
		const merged = mergeAnalyses([analysis([observation('deaths', 886, 0, 'a', 96)])]);
		expect(find(merged, 'deaths').status).toBe('ok');
	});

	it('marks statistics that were not found as missing without inventing a value', () => {
		const merged = mergeAnalyses([analysis([observation('kills', 1, 0)])]);
		expect(find(merged, 'deaths')).toMatchObject({
			status: 'missing',
			value: null,
			candidates: []
		});
	});

	it('counts name votes across screenshots', () => {
		const merged = mergeAnalyses([
			{ ...analysis([]), names: [{ text: 'Tester', confidence: 80, screenshot: 0, pass: 'a' }] },
			{
				...analysis([]),
				names: [
					{ text: 'Tester', confidence: 90, screenshot: 1, pass: 'a' },
					{ text: 'Tesler', confidence: 40, screenshot: 1, pass: 'b' }
				]
			}
		]);
		expect(merged.names[0]).toEqual({ text: 'Tester', votes: 2, confidence: 90 });
		expect(merged.names).toHaveLength(2);
	});
});

describe('checkScreenshots', () => {
	it('warns when a screenshot contributes almost nothing', () => {
		const issues = checkScreenshots([
			analysis([
				observation('kills', 1, 0),
				observation('deaths', 1, 0),
				observation('level', 1, 0)
			]),
			analysis([], 1)
		]);
		expect(issues.some((i) => i.code === 'tooFewRows' && i.params.screenshot === 2)).toBe(true);
	});

	it('warns when the second screenshot adds no new statistics', () => {
		const same = [observation('kills', 1, 0), observation('deaths', 1, 0)];
		const issues = checkScreenshots([
			analysis(same),
			analysis(same.map((o) => ({ ...o, screenshot: 1 })))
		]);
		expect(issues.map((i) => i.code)).toContain('screenshotAddedNothing');
	});

	it('is quiet for two complementary screenshots with an overlap', () => {
		const issues = checkScreenshots([
			analysis([
				observation('kills', 1, 0),
				observation('shotsHit', 2, 0),
				observation('deaths', 3, 0)
			]),
			analysis([
				observation('shotsHit', 2, 1),
				observation('missionsPlayed', 4, 1),
				observation('totalXp', 5, 1)
			])
		]);
		expect(issues).toEqual([]);
	});
});
