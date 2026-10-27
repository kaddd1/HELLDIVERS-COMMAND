<script lang="ts">
	import { buildPortrait } from '#lib/analytics/portrait.ts';
	import MetricTile from '#lib/components/ui/MetricTile.svelte';
	import { toStatValues, type StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatDate, formatDecimal, formatHours, formatInt } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import FactList from './FactList.svelte';
	import Gauge from './Gauge.svelte';
	import PreferenceChart from './PreferenceChart.svelte';

	interface Props {
		/** The latest confirmed snapshot. */
		snapshot: StatsSnapshot;
	}

	let { snapshot }: Props = $props();

	const t = ru.intelligence.career;
	const values = $derived(toStatValues(snapshot.stats));
	const portrait = $derived(buildPortrait(values));
	const num = (value: number | null): string | null =>
		value === null ? null : formatDecimal(value);
</script>

<div class="space-y-8">
	<div class="space-y-2">
		<p class="text-sm text-text">
			{t.basis(
				formatDate(snapshot.capturedAt),
				formatInt(portrait.missions),
				formatHours(snapshot.stats.timePlayedSeconds)
			)}
		</p>
		{#if !portrait.reliable}
			<p role="status" class="border-l-2 border-accent pl-3 text-sm text-text">{t.lowSample}</p>
		{/if}
	</div>

	<section aria-labelledby="traits-title">
		<h3
			id="traits-title"
			class="mb-3 font-display text-sm font-semibold tracking-widest text-text-muted uppercase"
		>
			{t.traits}
		</h3>
		<div class="grid gap-3 lg:grid-cols-3">
			<Gauge
				value={portrait.accuracy}
				name={t.gauges.accuracy.name}
				caption={t.gauges.accuracy.caption(
					formatInt(values.shotsHit ?? 0),
					formatInt(values.shotsFired ?? 0)
				)}
			/>
			<Gauge
				value={portrait.success}
				name={t.gauges.success.name}
				caption={t.gauges.success.caption(
					formatInt(values.missionsCompleted ?? 0),
					formatInt(values.missionsPlayed ?? 0)
				)}
			/>
			<Gauge
				value={portrait.extraction}
				name={t.gauges.extraction.name}
				caption={t.gauges.extraction.caption(
					formatInt(values.successfulExtractions ?? 0),
					formatInt(values.missionsPlayed ?? 0)
				)}
			/>
		</div>
		<div class="mt-3 grid gap-3 lg:grid-cols-3">
			<MetricTile
				size="lg"
				label={t.numbers.kd.name}
				value={num(portrait.kd)}
				note={t.numbers.kd.caption}
			/>
			<MetricTile
				size="lg"
				label={t.numbers.killsPerMission.name}
				value={num(portrait.killsPerMission)}
				note={portrait.deathsPerMission === null
					? undefined
					: t.numbers.killsPerMission.caption(formatDecimal(portrait.deathsPerMission))}
			/>
			<MetricTile
				size="lg"
				label={t.numbers.pace.name}
				value={num(portrait.killsPerMinute)}
				note={portrait.minutesPerMission === null
					? undefined
					: t.numbers.pace.caption(formatDecimal(portrait.minutesPerMission))}
			/>
		</div>
	</section>

	<section aria-labelledby="prefs-title">
		<h3
			id="prefs-title"
			class="mb-3 font-display text-sm font-semibold tracking-widest text-text-muted uppercase"
		>
			{t.preferences}
		</h3>
		<PreferenceChart compositions={portrait.compositions} />
	</section>

	{#if portrait.facts.length > 0}
		<section aria-labelledby="facts-title">
			<h3
				id="facts-title"
				class="mb-3 font-display text-sm font-semibold tracking-widest text-text-muted uppercase"
			>
				{t.facts}
			</h3>
			<FactList facts={portrait.facts} />
		</section>
	{/if}

	<p class="max-w-3xl text-xs text-text-muted">{t.scope}</p>
</div>
