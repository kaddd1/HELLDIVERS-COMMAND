<script lang="ts">
	import { barChartOption, lineChartOption } from '#lib/analytics/chartOptions.ts';
	import {
		buildIntervalSeries,
		buildIntervals,
		buildSeries,
		type Series
	} from '#lib/analytics/history.ts';
	import Panel from '#lib/components/ui/Panel.svelte';
	import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
	import {
		STAT_DEFINITIONS,
		getDefinition,
		type StatGroup,
		type StatKey
	} from '#lib/domain/statDefinitions.ts';
	import { getStatValue, type StatsSnapshot } from '#lib/domain/stats.ts';
	import { changeOfCount, formatDuration, formatStatValue } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import EChart from './EChart.svelte';

	interface Props {
		snapshots: StatsSnapshot[];
	}

	let { snapshots }: Props = $props();

	const t = ru.analytics.progress;
	const GROUPS: StatGroup[] = ['profile', 'kills', 'combat', 'stratagems', 'missions'];

	let metric = $state<StatKey>('kills');
	let mode = $state<'cumulative' | 'increments'>('cumulative');

	const definition = $derived(getDefinition(metric));
	const spanMs = $derived(
		snapshots.length > 1
			? new Date(snapshots.at(-1)!.capturedAt).getTime() -
					new Date(snapshots[0].capturedAt).getTime()
			: 0
	);

	const format = (value: number): string => formatStatValue(metric, Math.round(value));

	const cumulative = $derived(buildSeries(snapshots, (s) => getStatValue(s.stats, metric)));
	const increments = $derived(
		buildIntervalSeries(buildIntervals(snapshots), (i) => i.deltas[metric] ?? null)
	);

	const option = $derived(
		mode === 'cumulative'
			? lineChartOption(
					[{ name: definition.label, points: cumulative.points, area: true }],
					cumulative.breaks,
					{ formatValue: format, spanMs }
				)
			: barChartOption(
					[
						{
							name: definition.label,
							points: increments.filter((p) => p.value !== null).map((p) => [p.t, p.value])
						}
					],
					{ formatValue: format, spanMs, stack: false }
				)
	);

	const known = $derived(cumulative.points.filter((p): p is [number, number] => p[1] !== null));
	const growth = $derived(
		known.length >= 2 && cumulative.breaks.length === 0
			? changeOfCount(known.at(-1)![1], known[0][1])
			: null
	);
	const hasIncrements = $derived(increments.some((p) => p.value !== null));

	function label(series: Series): string {
		return t.aria(definition.label, series.points.filter((p) => p[1] !== null).length);
	}
</script>

<Panel title={t.title}>
	<div class="space-y-4">
		<p class="text-sm text-text-muted">{t.lead}</p>

		<div class="flex flex-wrap items-end gap-4">
			<div class="min-w-0">
				<label
					for="progress-metric"
					class="mb-1 block font-display text-xs tracking-widest text-text-muted uppercase"
				>
					{t.metric}
				</label>
				<select
					id="progress-metric"
					bind:value={metric}
					class="block w-72 max-w-full border border-line bg-bg px-3 py-2 text-text"
				>
					{#each GROUPS as group (group)}
						<optgroup label={ru.importer.review.groups[group]}>
							{#each STAT_DEFINITIONS.filter((d) => d.group === group) as d (d.key)}
								<option value={d.key}>{d.label}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>
			<SegmentedControl
				label={t.mode}
				bind:value={mode}
				options={[
					{ value: 'cumulative', label: t.cumulative },
					{ value: 'increments', label: t.increments }
				]}
			/>
			{#if growth && mode === 'cumulative'}
				<p class="pb-2 text-sm text-text-muted tabular-nums">
					{ru.analytics.progress.change}:
					<span class="text-accent">{growth.text}</span>
					{#if definition.kind === 'duration'}
						({formatDuration(Math.abs((known.at(-1)![1] ?? 0) - known[0][1]))})
					{/if}
				</p>
			{/if}
		</div>

		{#if mode === 'increments' && !hasIncrements}
			<p class="py-12 text-center text-sm text-text-muted">{ru.analytics.ratios.noValues}</p>
		{:else}
			<EChart {option} label={label(cumulative)} />
			{#if mode === 'increments'}
				<p class="text-xs text-text-muted">{t.incrementNote}</p>
			{/if}
		{/if}
	</div>
</Panel>
