<script lang="ts">
	import { lineChartOption } from '#lib/analytics/chartOptions.ts';
	import { buildIntervalSeries, buildIntervals, buildSeries } from '#lib/analytics/history.ts';
	import { RATIOS, getRatio, type RatioId } from '#lib/analytics/metrics.ts';
	import Panel from '#lib/components/ui/Panel.svelte';
	import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
	import { toStatValues, type StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatRatio } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import EChart from './EChart.svelte';

	interface Props {
		snapshots: StatsSnapshot[];
	}

	let { snapshots }: Props = $props();

	const t = ru.analytics.ratios;

	let ratioId = $state<RatioId>('kd');
	let mode = $state<'all' | 'interval'>('all');

	const ratio = $derived(getRatio(ratioId));
	const name = $derived(t.names[ratioId]);
	const spanMs = $derived(
		snapshots.length > 1
			? new Date(snapshots.at(-1)!.capturedAt).getTime() -
					new Date(snapshots[0].capturedAt).getTime()
			: 0
	);

	const series = $derived.by(() => {
		if (mode === 'all') {
			return buildSeries(snapshots, (s) => ratio.compute(toStatValues(s.stats)));
		}
		// Per-interval ratios have no value across resets or anomalies, which leaves a gap.
		const points = buildIntervalSeries(buildIntervals(snapshots), (i) =>
			ratio.compute(i.deltas)
		).map((p): [number, number | null] => [p.t, p.value]);
		return { points, breaks: [] };
	});

	const count = $derived(series.points.filter((p) => p[1] !== null).length);

	const option = $derived(
		lineChartOption([{ name, points: series.points }], series.breaks, {
			formatValue: (value) => formatRatio(value, ratio.format),
			spanMs
		})
	);
</script>

<Panel title={t.title}>
	<div class="space-y-4">
		<div class="flex flex-wrap items-end gap-4">
			<div class="min-w-0">
				<label
					for="ratio-metric"
					class="mb-1 block font-display text-xs tracking-widest text-text-muted uppercase"
				>
					{t.metric}
				</label>
				<select
					id="ratio-metric"
					bind:value={ratioId}
					class="block w-72 max-w-full border border-line bg-bg px-3 py-2 text-text"
				>
					{#each RATIOS as r (r.id)}
						<option value={r.id}>{t.names[r.id]}</option>
					{/each}
				</select>
			</div>
			<SegmentedControl
				label={t.mode}
				bind:value={mode}
				options={[
					{ value: 'all', label: t.all },
					{ value: 'interval', label: t.interval }
				]}
			/>
		</div>

		<p class="text-xs text-text-muted">{mode === 'all' ? t.allNote : t.intervalNote}</p>

		{#if count === 0}
			<p class="py-12 text-center text-sm text-text-muted">{t.noValues}</p>
		{:else}
			<EChart {option} label={t.aria(name, count)} />
		{/if}
	</div>
</Panel>
