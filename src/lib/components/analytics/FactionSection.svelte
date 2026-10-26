<script lang="ts">
	import { barChartOption, lineChartOption } from '#lib/analytics/chartOptions.ts';
	import { buildIntervalSeries, buildIntervals, buildSeries } from '#lib/analytics/history.ts';
	import Panel from '#lib/components/ui/Panel.svelte';
	import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
	import { getStatValue, type StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatInt } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import EChart from './EChart.svelte';

	interface Props {
		snapshots: StatsSnapshot[];
	}

	let { snapshots }: Props = $props();

	const t = ru.analytics.factions;
	const FACTIONS = [
		{ key: 'killsBugs', name: ru.extra.bugs },
		{ key: 'killsAutomatons', name: ru.extra.automatons },
		{ key: 'killsIlluminate', name: ru.extra.illuminate }
	] as const;

	let mode = $state<'cumulative' | 'increments'>('cumulative');

	const spanMs = $derived(
		snapshots.length > 1
			? new Date(snapshots.at(-1)!.capturedAt).getTime() -
					new Date(snapshots[0].capturedAt).getTime()
			: 0
	);
	const hasData = $derived(
		snapshots.some((s) => FACTIONS.some((f) => getStatValue(s.stats, f.key) !== null))
	);
	const complete = $derived(
		snapshots.every((s) => FACTIONS.every((f) => getStatValue(s.stats, f.key) !== null))
	);

	const cumulative = $derived(
		FACTIONS.map((f) => ({
			name: f.name,
			series: buildSeries(snapshots, (s) => getStatValue(s.stats, f.key))
		}))
	);
	const increments = $derived(
		FACTIONS.map((f) => ({
			name: f.name,
			points: buildIntervalSeries(buildIntervals(snapshots), (i) => i.deltas[f.key] ?? null)
				.filter((p) => p.value !== null)
				.map((p): [number, number] => [p.t, p.value as number])
		}))
	);

	const option = $derived(
		mode === 'cumulative'
			? lineChartOption(
					cumulative.map((c) => ({ name: c.name, points: c.series.points })),
					cumulative[0].series.breaks,
					{ formatValue: (v) => formatInt(Math.round(v)), spanMs }
				)
			: barChartOption(increments, {
					formatValue: (v) => formatInt(Math.round(v)),
					spanMs,
					stack: true
				})
	);
	const hasIncrements = $derived(increments.some((s) => s.points.length > 0));
</script>

{#if hasData}
	<Panel title={t.title}>
		<div class="space-y-4">
			<div class="flex flex-wrap items-end gap-4">
				<SegmentedControl
					label={ru.analytics.progress.mode}
					bind:value={mode}
					options={[
						{ value: 'cumulative', label: ru.analytics.progress.cumulative },
						{ value: 'increments', label: ru.analytics.progress.increments }
					]}
				/>
			</div>
			{#if !complete}
				<p class="text-xs text-text-muted">{t.missing}</p>
			{/if}
			{#if mode === 'increments' && !hasIncrements}
				<p class="py-12 text-center text-sm text-text-muted">{ru.analytics.ratios.noValues}</p>
			{:else}
				<EChart {option} label={t.aria(snapshots.length)} />
			{/if}
		</div>
	</Panel>
{/if}
