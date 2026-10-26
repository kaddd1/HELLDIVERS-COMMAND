<script lang="ts">
	import { onMount } from 'svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import { successRate, type PlayerStats } from '#lib/domain/stats.ts';
	import { formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		stats: PlayerStats;
	}

	let { stats }: Props = $props();

	const t = ru.career.missions;
	const RADIUS = 52;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	const rate = $derived(successRate(stats));
	const unfinished = $derived(stats.missionsPlayed - stats.missionsCompleted);

	let shown = $state(false);
	onMount(() => {
		const frame = requestAnimationFrame(() => (shown = true));
		return () => cancelAnimationFrame(frame);
	});
</script>

<Panel title={t.title}>
	<div class="flex items-center gap-6">
		<div class="relative size-36 shrink-0">
			<svg
				viewBox="0 0 120 120"
				class="size-full -rotate-90"
				role="img"
				aria-label={t.rateAria(formatPercent(rate))}
			>
				<circle
					cx="60"
					cy="60"
					r={RADIUS}
					fill="none"
					stroke="var(--color-surface-raised)"
					stroke-width="10"
				/>
				{#if rate !== null}
					<circle
						cx="60"
						cy="60"
						r={RADIUS}
						fill="none"
						stroke="var(--color-accent)"
						stroke-width="10"
						stroke-dasharray={CIRCUMFERENCE}
						stroke-dashoffset={shown ? CIRCUMFERENCE * (1 - rate) : CIRCUMFERENCE}
						class="transition-[stroke-dashoffset] duration-1000 ease-out"
					/>
				{/if}
			</svg>
			<span
				class="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold tabular-nums"
			>
				{formatPercent(rate)}
			</span>
		</div>

		<dl class="grid flex-1 gap-3 text-sm">
			<div class="flex items-baseline justify-between border-b border-line pb-2">
				<dt class="text-text-muted">{t.played}</dt>
				<dd class="font-display text-xl font-semibold tabular-nums">
					{formatInt(stats.missionsPlayed)}
				</dd>
			</div>
			<div class="flex items-baseline justify-between border-b border-line pb-2">
				<dt class="text-text-muted">{t.completed}</dt>
				<dd class="font-display text-xl font-semibold text-accent tabular-nums">
					{formatInt(stats.missionsCompleted)}
				</dd>
			</div>
			<div class="flex items-baseline justify-between">
				<dt class="text-text-muted">{t.unfinished}</dt>
				<dd class="font-display text-xl font-semibold tabular-nums">{formatInt(unfinished)}</dd>
			</div>
		</dl>
	</div>
</Panel>
