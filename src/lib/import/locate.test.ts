import { describe, expect, it } from 'vitest';
import { SCREEN_ONE, headerWords, rowsToWords } from './fixtures.ts';
import { locateLayout } from './locate.ts';

const WIDTH = 1000;
const HEIGHT = 1000;

describe('locateLayout', () => {
	it('finds the stats panel around the recognized rows', () => {
		const words = rowsToWords(SCREEN_ONE, { left: 200, right: 500, top: 250 });
		const { panel } = locateLayout(words, WIDTH, HEIGHT);
		expect(panel).not.toBeNull();
		// Labels start at x=200 and values end at x=500.
		expect(panel!.x0).toBeLessThan(0.2);
		expect(panel!.x0).toBeGreaterThan(0.15);
		expect(panel!.x1).toBeGreaterThan(0.5);
		expect(panel!.x1).toBeLessThan(0.56);
		expect(panel!.y0).toBeLessThan(0.25);
	});

	it('follows the panel when the layout shifts', () => {
		const left = locateLayout(rowsToWords(SCREEN_ONE, { left: 100, right: 400 }), WIDTH, HEIGHT);
		const right = locateLayout(rowsToWords(SCREEN_ONE, { left: 500, right: 800 }), WIDTH, HEIGHT);
		expect(right.panel!.x0 - left.panel!.x0).toBeCloseTo(0.4, 1);
	});

	it('ignores noise words next to the panel', () => {
		const noise = rowsToWords([{ label: 'Rf', value: '8' }], { left: 700, right: 760, top: 60 });
		const { panel } = locateLayout(
			[...rowsToWords(SCREEN_ONE, { left: 200, right: 500 }), ...noise],
			WIDTH,
			HEIGHT
		);
		expect(panel!.x1).toBeLessThan(0.56);
	});

	it('returns no panel when fewer than three known rows are visible', () => {
		const { panel } = locateLayout(rowsToWords(SCREEN_ONE.slice(0, 2)), WIDTH, HEIGHT);
		expect(panel).toBeNull();
	});

	it('finds the header from the "Уровень" line', () => {
		const { header } = locateLayout(headerWords('Tester', 86, 400, 170), WIDTH, HEIGHT);
		expect(header).not.toBeNull();
		expect(header!.x0).toBeLessThanOrEqual(0.4);
		// The name sits above the level line and must be inside the region.
		expect(header!.y0 * HEIGHT).toBeLessThan(170);
		expect(header!.y1 * HEIGHT).toBeGreaterThan(194);
	});

	it('returns no header when there is no level line', () => {
		expect(locateLayout(rowsToWords(SCREEN_ONE), WIDTH, HEIGHT).header).toBeNull();
	});
});
