<script lang="ts">
	import { getRatio, type RatioId } from '#lib/analytics/metrics.ts';
	import type { Interval } from '#lib/analytics/history.ts';
	import MetricTile from '#lib/components/ui/MetricTile.svelte';
	import { toStatValues, type StatsSnapshot } from '#lib/domain/stats.ts';
	import {
		changeOfCount,
		changeOfRatio,
		formatDate,
		formatElapsed,
		formatHours,
		formatInt,
		formatRatio
	} from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		latest: StatsSnapshot;
		interval: Interval | null;
	}

	let { latest, interval }: Props = $props();

	const t = ru.overview;
	const values = $derived(toStatValues(latest.stats));
	/** Only compare with the previous snapshot when the counters grew consistently. */
	const comparable = $derived(interval?.status === 'ok' ? interval : null);

	function ratio(id: RatioId) {
		const definition = getRatio(id);
		const current = definition.compute(values);
		const previous = comparable ? definition.compute(toStatValues(comparable.from.stats)) : null;
		return {
			value: current === null ? null : formatRatio(current, definition.format),
			change: changeOfRatio(current, previous, definition.format)
		};
	}

	const highlights = $derived(
		(
			[
				['kd', ru.analytics.ratios.names.kd],
				['success', ru.analytics.ratios.names.success],
				['accuracy', ru.analytics.ratios.names.accuracy],
				['killsPerMission', ru.analytics.ratios.names.killsPerMission]
			] as const
		).map(([id, label]) => ({ id, label, ...ratio(id) }))
	);

	function count(key: 'kills' | 'deaths' | 'missionsPlayed' | 'missionsCompleted' | 'totalXp') {
		const current = values[key];
		if (current === undefined) return { value: null, change: null };
		const previous = comparable ? toStatValues(comparable.from.stats)[key] : undefined;
		return {
			value: formatInt(current),
			change: previous === undefined ? null : changeOfCount(current, previous)
		};
	}

	const totals = $derived([
		{ label: t.metrics.kills, ...count('kills') },
		{ label: t.metrics.deaths, ...count('deaths') },
		{ label: t.metrics.missions, ...count('missionsPlayed') },
		{ label: t.metrics.completed, ...count('missionsCompleted') },
		{
			label: t.metrics.time,
			value:
				latest.stats.timePlayedSeconds === null
					? null
					: formatHours(latest.stats.timePlayedSeconds),
			change: null
		},
		{ label: t.metrics.xp, ...count('totalXp') }
	]);

	const periodItems = $derived.by(() => {
		if (!comparable) return [];
		const d = comparable.deltas;
		const items: { label: string; value: string }[] = [];
		if (d.kills !== undefined)
			items.push({ label: t.metrics.kills, value: `+${formatInt(d.kills)}` });
		if (d.deaths !== undefined)
			items.push({ label: t.metrics.deaths, value: `+${formatInt(d.deaths)}` });
		if (d.missionsCompleted !== undefined) {
			items.push({ label: t.metrics.completed, value: `+${formatInt(d.missionsCompleted)}` });
		}
		const kd = getRatio('kd').compute(d);
		if (kd !== null) items.push({ label: t.periodKd, value: formatRatio(kd, 'decimal') });
		return items;
	});
</script>

<section class="space-y-6">
	<div>
		<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<h2 class="font-display text-sm font-semibold tracking-widest text-accent uppercase">
				{t.highlights}
			</h2>
			<p class="text-xs text-text-muted" aria-live="polite">
				{#if !interval}
					{t.compareNone}
				{:else if interval.status === 'ok'}
					{t.compareWith(formatDate(interval.from.capturedAt))}, {formatElapsed(interval.seconds)}
				{:else if interval.status === 'reset'}
					{t.compareReset}
				{:else}
					{t.compareAnomaly}
				{/if}
			</p>
		</div>
		<div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each highlights as item (item.id)}
				<MetricTile
					size="lg"
					polarity="positive"
					label={item.label}
					value={item.value}
					change={item.change}
				/>
			{/each}
		</div>

		{#if comparable}
			<dl class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
				<dt class="font-display tracking-widest text-text uppercase">{t.period}</dt>
				{#each periodItems as item (item.label)}
					<dd class="text-text-muted">
						{item.label}: <span class="text-text tabular-nums">{item.value}</span>
					</dd>
				{/each}
			</dl>
		{/if}
	</div>

	<div>
		<h2 class="font-display text-sm font-semibold tracking-widest text-accent uppercase">
			{t.totals}
		</h2>
		<div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
			{#each totals as item (item.label)}
				<MetricTile label={item.label} value={item.value} change={item.change} />
			{/each}
		</div>
	</div>
</section>
