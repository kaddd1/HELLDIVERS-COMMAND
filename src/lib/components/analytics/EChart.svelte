<script lang="ts">
	import { onMount } from 'svelte';
	import type { ECharts, EChartsCoreOption } from 'echarts/core';
	import { loadEcharts } from '#lib/analytics/echarts.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		option: EChartsCoreOption;
		label: string;
		height?: number;
	}

	let { option, label, height = 340 }: Props = $props();

	let host = $state<HTMLDivElement>();
	let chart: ECharts | null = null;
	let status = $state<'loading' | 'ready' | 'failed'>('loading');

	onMount(() => {
		let disposed = false;
		let observer: ResizeObserver | undefined;

		loadEcharts()
			.then((echarts) => {
				if (disposed || !host) return;
				chart = echarts.init(host, 'command-center', { renderer: 'canvas' });
				status = 'ready';
				observer = new ResizeObserver(() => chart?.resize());
				observer.observe(host);
			})
			.catch(() => {
				if (!disposed) status = 'failed';
			});

		return () => {
			disposed = true;
			observer?.disconnect();
			chart?.dispose();
			chart = null;
		};
	});

	$effect(() => {
		if (status === 'ready' && chart) chart.setOption(option, { notMerge: true });
	});
</script>

<div class="relative" style:height="{height}px">
	<div bind:this={host} role="img" aria-label={label} class="size-full"></div>
	{#if status !== 'ready'}
		<div
			class="absolute inset-0 flex items-center justify-center text-sm {status === 'failed'
				? 'text-danger'
				: 'text-text-muted'}"
			role={status === 'failed' ? 'alert' : 'status'}
		>
			{status === 'failed' ? ru.analytics.chartFailed : ru.analytics.chartLoading}
		</div>
	{/if}
</div>
