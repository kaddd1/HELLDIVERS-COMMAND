<script lang="ts">
	import {
		baselineValues,
		buildCompositions,
		buildInsights,
		compareMetrics,
		compositionShifts,
		getMetric,
		type BaselineMode,
		type PeriodOption
	} from '#lib/analytics/profile.ts';
	import { radarOption, type RadarAxis } from '#lib/analytics/profileCharts.ts';
	import EChart from '#lib/components/analytics/EChart.svelte';
	import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
	import { formatDate, formatInt, formatRatio } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import CompositionBars from './CompositionBars.svelte';
	import InsightList from './InsightList.svelte';

	interface Props {
		options: PeriodOption[];
	}

	let { options }: Props = $props();

	const t = ru.intelligence;
	const p = t.period;

	let periodId = $state<string | null>(null);
	let requestedMode = $state<BaselineMode>('career');

	const selected = $derived(options.find((o) => o.id === periodId) ?? options[0] ?? null);
	const mode = $derived<BaselineMode>(
		requestedMode === 'previous' && selected?.previous ? 'previous' : 'career'
	);
	const baseline = $derived(selected ? baselineValues(selected, mode) : null);
	const comparisons = $derived(
		selected && baseline ? compareMetrics(selected.interval.deltas, baseline) : []
	);
	const periodCompositions = $derived(selected ? buildCompositions(selected.interval.deltas) : []);
	const baselineCompositions = $derived(baseline ? buildCompositions(baseline) : []);
	const insights = $derived(
		buildInsights(comparisons, compositionShifts(periodCompositions, baselineCompositions))
	);

	const axes = $derived<RadarAxis[]>(
		comparisons
			.filter((c) => getMetric(c.id).radar && c.index !== null)
			.map((c) => {
				const format = getMetric(c.id).format;
				return {
					name: t.metrics[c.id].name,
					index: c.index as number,
					periodText: formatRatio(c.period.value, format),
					baselineText: formatRatio(c.baseline.value, format)
				};
			})
	);
	const rows = $derived(comparisons.filter((c) => c.period.reliable));

	function label(option: PeriodOption): string {
		if (option.whole) return p.wholePeriod;
		const { from, to, deltas } = option.interval;
		const text = p.periodLabel(formatDate(from.capturedAt), formatDate(to.capturedAt));
		return deltas.missionsPlayed === undefined
			? text
			: `${text} · ${p.periodMeta(formatInt(deltas.missionsPlayed))}`;
	}

	const baselineOptions = $derived(
		selected?.previous
			? [
					{ value: 'career' as const, label: p.baselines.career },
					{ value: 'previous' as const, label: p.baselines.previous }
				]
			: [{ value: 'career' as const, label: p.baselines.career }]
	);
	const GROUPS = ['factions', 'methods', 'stratagems'] as const;
</script>

{#if selected}
	<div class="space-y-8">
		<p class="max-w-3xl text-sm text-text-muted">{p.lead}</p>

		<div class="flex flex-wrap items-end gap-x-6 gap-y-4">
			<div class="min-w-0">
				<label
					for="period-select"
					class="mb-1 block font-display text-xs tracking-widest text-text-muted uppercase"
				>
					{p.label}
				</label>
				<select
					id="period-select"
					bind:value={periodId}
					class="block w-[30rem] max-w-full border border-line bg-bg px-3 py-2 text-text"
				>
					{#each options as option (option.id)}
						<option value={option.id} selected={option.id === selected.id}>{label(option)}</option>
					{/each}
				</select>
			</div>
			<SegmentedControl label={p.baseline} bind:value={requestedMode} options={baselineOptions} />
		</div>

		<div class="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
			<section aria-labelledby="radar-title">
				<h3
					id="radar-title"
					class="font-display text-sm font-semibold tracking-widest text-text-muted uppercase"
				>
					{t.radar.title}
				</h3>
				{#if axes.length >= 3}
					<EChart option={radarOption(axes)} label={t.radar.aria(axes.length)} height={380} />
					<p class="text-xs text-text-muted">{t.radar.scaleNote}</p>
				{:else}
					<p class="py-16 text-center text-sm text-text-muted">{t.radar.tooFew}</p>
				{/if}
			</section>

			<section aria-labelledby="insights-title">
				<h3
					id="insights-title"
					class="mb-3 font-display text-sm font-semibold tracking-widest text-text-muted uppercase"
				>
					{t.insights.title}
				</h3>
				<InsightList {insights} />
			</section>
		</div>

		{#if rows.length > 0}
			<section>
				<h3
					class="mb-3 font-display text-sm font-semibold tracking-widest text-text-muted uppercase"
				>
					{p.changes.title}
				</h3>
				<ul class="grid gap-x-8 md:grid-cols-2">
					{#each rows as row (row.id)}
						{@const info = t.metrics[row.id]}
						{@const format = getMetric(row.id).format}
						<li
							class="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 text-sm"
						>
							<span class="text-text">{info.name}</span>
							<span class="text-right tabular-nums">
								<b class="font-display font-semibold text-text">
									{formatRatio(row.period.value, format)}
								</b>
								<span class="text-text-muted">
									· {p.changes.usual}
									{formatRatio(row.baseline.value, format)}
								</span>
								<span
									class={row.verdict === 'same' || row.verdict === 'unknown'
										? 'text-text-muted'
										: 'text-accent'}
								>
									· {p.changes.verdict[row.verdict]}
								</span>
							</span>
						</li>
					{/each}
				</ul>
				<p class="mt-3 text-xs text-text-muted">{p.noise}</p>
			</section>
		{/if}

		<section>
			<h3 class="mb-3 font-display text-sm font-semibold tracking-widest text-text-muted uppercase">
				{t.composition.title}
			</h3>
			<div class="grid gap-8 lg:grid-cols-3">
				{#each GROUPS as group (group)}
					<div>
						<p class="mb-3 text-sm text-text">{t.composition.groups[group]}</p>
						<CompositionBars
							period={periodCompositions.find((c) => c.id === group) ?? null}
							baseline={baselineCompositions.find((c) => c.id === group) ?? null}
							periodLabel={t.composition.period}
						/>
					</div>
				{/each}
			</div>
		</section>
	</div>
{/if}
