<script lang="ts">
	import { onMount } from 'svelte';
	import { formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		/** Share from 0 to 1, or `null` when the data is missing. */
		value: number | null;
		name: string;
		caption: string;
	}

	let { value, name, caption }: Props = $props();

	const RADIUS = 40;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	let shown = $state(false);
	onMount(() => {
		const frame = requestAnimationFrame(() => (shown = true));
		return () => cancelAnimationFrame(frame);
	});
</script>

<div
	class="flex items-center gap-4 border-l-2 bg-surface-raised p-4 {value === null
		? 'border-line'
		: 'border-accent'}"
>
	<div class="relative size-24 shrink-0">
		<svg
			viewBox="0 0 100 100"
			class="size-full -rotate-90"
			role="img"
			aria-label="{name}: {value === null ? ru.intelligence.career.noData : formatPercent(value)}"
		>
			<circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--color-bg)" stroke-width="9" />
			{#if value !== null}
				<circle
					cx="50"
					cy="50"
					r={RADIUS}
					fill="none"
					stroke="var(--color-accent)"
					stroke-width="9"
					stroke-dasharray={CIRCUMFERENCE}
					stroke-dashoffset={shown ? CIRCUMFERENCE * (1 - Math.min(1, value)) : CIRCUMFERENCE}
					class="transition-[stroke-dashoffset] duration-1000 ease-out"
				/>
			{/if}
		</svg>
		<span
			class="absolute inset-0 flex items-center justify-center font-display text-xl font-bold tabular-nums {value ===
			null
				? 'text-text-muted'
				: 'text-text'}"
		>
			{value === null ? ru.common.noValue : formatPercent(value)}
		</span>
	</div>
	<div class="min-w-0">
		<p class="font-display text-xs tracking-widest text-text-muted uppercase">{name}</p>
		<p class="mt-1 text-sm text-text-muted">
			{value === null ? ru.intelligence.career.noData : caption}
		</p>
	</div>
</div>
