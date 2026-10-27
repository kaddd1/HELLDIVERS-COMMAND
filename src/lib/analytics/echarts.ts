import type * as EChartsCore from 'echarts/core';

/** Series colors; distinct in hue and lightness so they stay readable for color-blind viewers. */
export const PALETTE = ['#f2c200', '#5aa9e6', '#e0533d', '#6fae5a', '#a98be0', '#e08a3c'] as const;

export const CHART_COLORS = {
	text: '#9a9d96',
	textStrong: '#e8e6df',
	line: '#34383c',
	grid: '#26292c',
	surface: '#1a1c1e',
	accent: '#f2c200',
	danger: '#e0533d'
} as const;

const THEME = {
	color: [...PALETTE],
	backgroundColor: 'transparent',
	textStyle: { fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif", color: CHART_COLORS.text }
};

let loading: Promise<typeof EChartsCore> | null = null;

export function loadEcharts(): Promise<typeof EChartsCore> {
	loading ??= (async () => {
		const [core, charts, components, features, renderers] = await Promise.all([
			import('echarts/core'),
			import('echarts/charts'),
			import('echarts/components'),
			import('echarts/features'),
			import('echarts/renderers')
		]);
		core.use([
			charts.LineChart,
			charts.BarChart,
			charts.RadarChart,
			charts.PieChart,
			components.GridComponent,
			components.RadarComponent,
			components.TooltipComponent,
			components.LegendComponent,
			components.DataZoomComponent,
			components.MarkLineComponent,
			features.LegacyGridContainLabel,
			renderers.CanvasRenderer
		]);
		core.registerTheme('command-center', THEME);
		return core;
	})();
	loading.catch(() => {
		loading = null;
	});
	return loading;
}
