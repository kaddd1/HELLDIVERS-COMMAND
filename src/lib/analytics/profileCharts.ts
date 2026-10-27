import type { EChartsCoreOption } from 'echarts/core';
import { ru } from '../i18n/ru.ts';
import { CHART_COLORS } from './echarts.ts';
import { INDEX_CAP, type CompositionId } from './profile.ts';

export interface RadarAxis {
	name: string;
	/** 100 × period / baseline. */
	index: number;
	periodText: string;
	baselineText: string;
}

/**
 * Radar of the period against the player's own baseline. The dashed ring is the baseline (100);
 * the filled shape is the period. Values above the cap are clipped; exact numbers are in the tooltip.
 */
export function radarOption(axes: RadarAxis[]): EChartsCoreOption {
	const t = ru.intelligence.radar;
	const clipped = axes.map((a) => Math.min(INDEX_CAP, Math.max(0, a.index)));

	return {
		animationDuration: 500,
		legend: {
			bottom: 0,
			icon: 'roundRect',
			itemGap: 20,
			textStyle: { color: CHART_COLORS.text }
		},
		tooltip: {
			trigger: 'item',
			backgroundColor: CHART_COLORS.surface,
			borderColor: CHART_COLORS.line,
			textStyle: { color: CHART_COLORS.textStrong },
			formatter: (params: { seriesName?: string; name: string }) => {
				const isPeriod = params.name === t.periodName;
				const rows = axes
					.map((a) => {
						const text = isPeriod
							? t.tooltipRow(a.periodText, Math.round(a.index), a.baselineText)
							: a.baselineText;
						return `<div style="display:flex;justify-content:space-between;gap:16px"><span>${a.name}</span><b>${text}</b></div>`;
					})
					.join('');
				return `<div style="margin-bottom:4px;color:${CHART_COLORS.text}">${params.name}</div>${rows}`;
			}
		},
		radar: {
			center: ['50%', '46%'],
			radius: '70%',
			shape: 'polygon',
			splitNumber: 4,
			indicator: axes.map((a) => ({ name: a.name, max: INDEX_CAP })),
			axisName: { color: CHART_COLORS.textStrong, fontSize: 12 },
			axisLine: { lineStyle: { color: CHART_COLORS.line } },
			splitLine: { lineStyle: { color: CHART_COLORS.grid } },
			splitArea: { show: false }
		},
		series: [
			{
				type: 'radar',
				symbolSize: 6,
				data: [
					{
						name: t.baselineName,
						value: axes.map(() => 100),
						symbol: 'none',
						lineStyle: { color: CHART_COLORS.text, width: 1.5, type: 'dashed' },
						itemStyle: { color: CHART_COLORS.text }
					},
					{
						name: t.periodName,
						value: clipped,
						lineStyle: { color: CHART_COLORS.accent, width: 2.5 },
						itemStyle: { color: CHART_COLORS.accent },
						areaStyle: { color: CHART_COLORS.accent, opacity: 0.16 }
					}
				]
			}
		]
	};
}

/**
 * Each distribution has its own palette, so the three charts read as different charts rather than
 * one chart with changing data. "Other" is always a neutral grey.
 */
const PALETTES: Record<CompositionId, Record<string, string>> = {
	factions: { bugs: '#f2a900', automatons: '#e0533d', illuminate: '#a98be0' },
	methods: { grenades: '#5aa9e6', melee: '#6fae5a', eagle: '#e08a3c' },
	stratagems: {
		orbital: '#e0533d',
		defensive: '#6fae5a',
		eagle: '#5aa9e6',
		supply: '#f2c200',
		reinforcement: '#a98be0'
	}
};
const OTHER_COLOR = '#5b5f63';

export function partColor(group: CompositionId, id: string): string {
	return id === 'other' ? OTHER_COLOR : (PALETTES[group][id] ?? OTHER_COLOR);
}

export interface DonutPart {
	name: string;
	value: number;
	color: string;
	/** Preformatted share, e.g. "44 %". */
	shareText: string;
}

/** Donut of one distribution. All slices grow from nothing into a full circle; hovering enlarges one. */
export function donutOption(
	parts: DonutPart[],
	valueText: (value: number) => string,
	animate = true
): EChartsCoreOption {
	return {
		animation: animate,
		animationDuration: 900,
		animationEasing: 'cubicOut',
		tooltip: {
			trigger: 'item',
			backgroundColor: CHART_COLORS.surface,
			borderColor: CHART_COLORS.line,
			textStyle: { color: CHART_COLORS.textStrong },
			formatter: (p: { name: string; value: number; data: DonutPart }) =>
				`<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.name}</span><b>${valueText(p.value)} · ${p.data.shareText}</b></div>`
		},
		series: [
			{
				type: 'pie',
				radius: ['58%', '84%'],
				center: ['50%', '50%'],
				startAngle: 90,
				animationType: 'expansion',
				padAngle: 1.5,
				label: { show: false },
				labelLine: { show: false },
				emphasis: { scaleSize: 6 },
				itemStyle: { borderColor: CHART_COLORS.surface, borderWidth: 2 },
				data: parts.map((part) => ({
					name: part.name,
					value: part.value,
					shareText: part.shareText,
					itemStyle: { color: part.color }
				}))
			}
		]
	};
}
