<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { donutOption, partColor, type DonutPart } from '#lib/analytics/profileCharts.ts';
	import type { Composition } from '#lib/analytics/profile.ts';
	import EChart from '#lib/components/analytics/EChart.svelte';
	import { formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		composition: Composition;
		animate: boolean;
		/** Pause before the chart is created and starts drawing itself, in milliseconds. */
		delay: number;
	}

	let { composition, animate, delay }: Props = $props();

	const t = ru.intelligence.preferences;
	const names = ru.intelligence.composition.parts;

	const parts = $derived<DonutPart[]>(
		composition.parts.map((p) => ({
			name: names[p.id as keyof typeof names],
			value: p.value,
			color: partColor(composition.id, p.id),
			shareText: formatPercent(p.share)
		}))
	);

	/** The chart is created only after the delay, so it always draws itself from nothing, as if shown for the first time. */
	let ready = $state(false);
	const total = new Tween(0, { duration: untrack(() => animate) ? 900 : 0, easing: cubicOut });

	onMount(() => {
		const start = () => {
			ready = true;
			void total.set(composition.total);
		};
		if (delay <= 0) {
			start();
			return;
		}
		const timer = setTimeout(start, delay);
		return () => clearTimeout(timer);
	});
</script>

<div class="relative size-full">
	{#if ready}
		<EChart
			option={donutOption(parts, (v) => formatInt(v), animate)}
			label={t.aria(t.tabs[composition.id])}
			height={256}
		/>
		<div
			class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
		>
			<span class="font-display text-2xl font-bold text-text tabular-nums">
				{formatInt(Math.round(total.current))}
			</span>
			<span class="text-xs text-text-muted">{t.center[composition.id]}</span>
		</div>
	{/if}
</div>
