<script lang="ts">
	import { onMount } from 'svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import {
		accuracy,
		deathsPerMission,
		killsPerHour,
		killsPerMission,
		type PlayerStats
	} from '#lib/domain/stats.ts';
	import { formatDecimal, formatHours, formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		stats: PlayerStats;
	}

	let { stats }: Props = $props();

	const t = ru.career.combat;
	const hitRate = $derived(accuracy(stats));

	const rows = $derived([
		{ label: t.killsPerMission, value: formatDecimal(killsPerMission(stats)) },
		{ label: t.deathsPerMission, value: formatDecimal(deathsPerMission(stats)) },
		{ label: t.killsPerHour, value: formatDecimal(killsPerHour(stats)) },
		{ label: t.timePlayed, value: formatHours(stats.timePlayedSeconds) },
		{
			label: t.shotsFired,
			value: stats.shotsFired === null ? ru.common.noValue : formatInt(stats.shotsFired)
		},
		{
			label: t.shotsHit,
			value: stats.shotsHit === null ? ru.common.noValue : formatInt(stats.shotsHit)
		}
	]);

	let shown = $state(false);
	onMount(() => {
		const frame = requestAnimationFrame(() => (shown = true));
		return () => cancelAnimationFrame(frame);
	});
</script>

<Panel title={t.title}>
	<div>
		<div class="flex items-baseline justify-between">
			<span class="text-sm text-text-muted">{t.accuracy}</span>
			<span class="font-display text-2xl font-bold tabular-nums">
				{hitRate === null ? ru.common.notProvided : formatPercent(hitRate)}
			</span>
		</div>
		<div class="mt-2 h-2 bg-surface-raised">
			{#if hitRate !== null}
				<div
					class="h-full bg-accent transition-[width] duration-700 ease-out"
					style:width="{shown ? hitRate * 100 : 0}%"
				></div>
			{/if}
		</div>
	</div>

	<dl class="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
		{#each rows as row (row.label)}
			<div class="flex items-baseline justify-between border-b border-line pb-2">
				<dt class="text-text-muted">{row.label}</dt>
				<dd class="font-display text-lg font-semibold tabular-nums">{row.value}</dd>
			</div>
		{/each}
	</dl>
</Panel>
