<script lang="ts">
	import { onMount } from 'svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import { kdRatio, killShare, type PlayerStats } from '#lib/domain/stats.ts';
	import { formatDecimal, formatInt } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		stats: PlayerStats;
	}

	let { stats }: Props = $props();

	const t = ru.career.kd;
	const share = $derived(killShare(stats));

	// Bars grow from zero once the component is on screen.
	let shown = $state(false);
	onMount(() => {
		const frame = requestAnimationFrame(() => (shown = true));
		return () => cancelAnimationFrame(frame);
	});
</script>

<Panel title={t.title}>
	<p class="font-display text-6xl font-bold text-accent tabular-nums">
		{formatDecimal(kdRatio(stats))}
	</p>

	<div
		role="img"
		aria-label={t.aria(formatInt(stats.kills), formatInt(stats.deaths))}
		class="mt-5 flex h-4 overflow-hidden bg-surface-raised"
	>
		{#if share !== null}
			<div
				class="bg-accent transition-[width] duration-700 ease-out"
				style:width="{shown ? share * 100 : 0}%"
			></div>
			<div class="flex-1 bg-danger/70"></div>
		{/if}
	</div>

	<dl class="mt-3 flex justify-between text-sm">
		<div>
			<dt class="flex items-center gap-2 text-text-muted">
				<span class="size-2 bg-accent"></span>{t.kills}
			</dt>
			<dd class="font-display text-xl font-semibold tabular-nums">{formatInt(stats.kills)}</dd>
		</div>
		<div class="text-right">
			<dt class="flex items-center justify-end gap-2 text-text-muted">
				{t.deaths}<span class="size-2 bg-danger/70"></span>
			</dt>
			<dd class="font-display text-xl font-semibold tabular-nums">{formatInt(stats.deaths)}</dd>
		</div>
	</dl>
</Panel>
