import { describe, expect, it } from 'vitest';
import { radarOption, type RadarAxis } from './profileCharts.ts';

const axes: RadarAxis[] = [
	{ name: 'A', index: 120, periodText: '12', baselineText: '10' },
	{ name: 'B', index: 450, periodText: '45', baselineText: '10' },
	{ name: 'C', index: -5, periodText: '0', baselineText: '10' }
];

type Option = {
	radar: { indicator: { name: string; max: number }[] };
	series: { data: { value: number[] }[] }[];
};

describe('radarOption', () => {
	const option = radarOption(axes) as unknown as Option;

	it('draws the baseline as a ring at 100 on every axis', () => {
		expect(option.series[0].data[0].value).toEqual([100, 100, 100]);
	});

	it('clips period values to the display scale without altering small ones', () => {
		expect(option.series[0].data[1].value).toEqual([120, 200, 0]);
	});

	it('uses one indicator per axis with the same maximum', () => {
		expect(option.radar.indicator).toEqual([
			{ name: 'A', max: 200 },
			{ name: 'B', max: 200 },
			{ name: 'C', max: 200 }
		]);
	});
});
