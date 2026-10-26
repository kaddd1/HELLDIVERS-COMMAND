import type { EChartsCoreOption } from 'echarts/core';
import { ru } from '../i18n/ru.ts';
import { CHART_COLORS, PALETTE } from './echarts.ts';
import type { Series } from './history.ts';

export interface LineSeriesInput {
	name: string;
	points: Series['points'];
	area?: boolean;
}

export interface BarSeriesInput {
	name: string;
	points: [number, number | null][];
}

interface CommonOptions {
	formatValue: (value: number) => string;
	yName?: string;
	spanMs: number;
}

const DAY = 24 * 60 * 60 * 1000;
const dateOnly = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });
const dateWithYear = new Intl.DateTimeFormat('ru-RU', {
	day: '2-digit',
	month: '2-digit',
	year: '2-digit'
});
const dateTime = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });

function axisLabel(spanMs: number) {
	return {
		color: CHART_COLORS.text,
		hideOverlap: true,
		formatter: (value: number) =>
			(spanMs > 330 * DAY ? dateWithYear : dateOnly).format(new Date(value))
	};
}

interface TooltipParam {
	axisValue: number;
	marker: string;
	seriesName: string;
	value: [number, number | null];
}

function tooltip(formatValue: (value: number) => string) {
	return {
		trigger: 'axis',
		backgroundColor: CHART_COLORS.surface,
		borderColor: CHART_COLORS.line,
		textStyle: { color: CHART_COLORS.textStrong },
		axisPointer: { type: 'line', lineStyle: { color: CHART_COLORS.line } },
		formatter: (raw: TooltipParam | TooltipParam[]) => {
			const params = (Array.isArray(raw) ? raw : [raw]).filter((p) => p.value?.[1] != null);
			if (params.length === 0) return '';
			const rows = params
				.map(
					(p) =>
						`<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker}${p.seriesName}</span><b>${formatValue(p.value[1] as number)}</b></div>`
				)
				.join('');
			return `<div style="margin-bottom:4px;color:${CHART_COLORS.text}">${dateTime.format(new Date(params[0].axisValue))}</div>${rows}`;
		}
	};
}

function marks(breaks: Series['breaks']) {
	return {
		symbol: 'none',
		silent: true,
		data: breaks.map((b) => {
			const color = b.status === 'reset' ? CHART_COLORS.accent : CHART_COLORS.danger;
			return {
				xAxis: b.t,
				lineStyle: { color, type: 'dashed', width: 1 },
				label: {
					formatter: b.status === 'reset' ? ru.analytics.resetMarker : ru.analytics.anomalyMarker,
					color,
					position: 'insideEndTop'
				}
			};
		})
	};
}

function base(options: CommonOptions, legend: boolean) {
	return {
		animationDuration: 500,
		grid: { left: 8, right: 16, top: legend ? 44 : 24, bottom: 36, containLabel: true },
		legend: legend
			? { top: 0, textStyle: { color: CHART_COLORS.text }, icon: 'roundRect' }
			: { show: false },
		tooltip: tooltip(options.formatValue),
		xAxis: {
			type: 'time',
			axisLine: { lineStyle: { color: CHART_COLORS.line } },
			axisTick: { show: false },
			splitLine: { show: false },
			axisLabel: axisLabel(options.spanMs)
		},
		dataZoom: [{ type: 'inside', filterMode: 'none' }]
	};
}

function yAxis(options: CommonOptions, zeroBase: boolean) {
	return {
		type: 'value',
		scale: !zeroBase,
		name: options.yName,
		nameTextStyle: { color: CHART_COLORS.text, align: 'left' },
		axisLabel: { color: CHART_COLORS.text, formatter: (v: number) => options.formatValue(v) },
		splitLine: { lineStyle: { color: CHART_COLORS.grid } }
	};
}

export function lineChartOption(
	series: LineSeriesInput[],
	breaks: Series['breaks'],
	options: CommonOptions
): EChartsCoreOption {
	return {
		...base(options, series.length > 1),
		color: [...PALETTE],
		yAxis: yAxis(options, false),
		series: series.map((s, index) => ({
			name: s.name,
			type: 'line',
			data: s.points,
			connectNulls: false,
			showSymbol: true,
			symbolSize: 7,
			lineStyle: { width: 2.5 },
			areaStyle: s.area ? { opacity: 0.08 } : undefined,
			markLine: index === 0 && breaks.length > 0 ? marks(breaks) : undefined
		}))
	};
}

export function barChartOption(
	series: BarSeriesInput[],
	options: CommonOptions & { stack: boolean }
): EChartsCoreOption {
	return {
		...base(options, series.length > 1),
		color: [...PALETTE],
		yAxis: yAxis(options, true),
		series: series.map((s) => ({
			name: s.name,
			type: 'bar',
			stack: options.stack ? 'total' : undefined,
			data: s.points,
			barMaxWidth: 36
		}))
	};
}
