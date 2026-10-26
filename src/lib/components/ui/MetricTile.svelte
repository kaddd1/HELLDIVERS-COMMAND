<script lang="ts">
	import type { Change } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		label: string;
		value: string | null;
		change?: Change | null;
		/** Whether growth is good news (ratios) or just a count (neutral). */
		polarity?: 'positive' | 'neutral';
		size?: 'lg' | 'md';
		note?: string;
	}

	let { label, value, change = null, polarity = 'neutral', size = 'md', note }: Props = $props();

	const tone = $derived.by(() => {
		if (!change || change.direction === 'flat' || polarity === 'neutral') return 'text-text-muted';
		return change.direction === 'up' ? 'text-ok' : 'text-danger';
	});
</script>

<div
	class="border-l-2 bg-surface-raised px-4 py-3 {value === null ? 'border-line' : 'border-accent'}"
>
	<p class="font-display text-xs tracking-widest text-text-muted uppercase">{label}</p>
	{#if value === null}
		<p
			class="mt-1 font-display {size === 'lg' ? 'text-3xl' : 'text-2xl'} font-bold text-text-muted"
		>
			{ru.common.noValue}
		</p>
		<p class="mt-1 text-xs text-text-muted">{ru.overview.unavailable}</p>
	{:else}
		<p
			class="mt-1 font-display font-bold text-text tabular-nums {size === 'lg'
				? 'text-4xl'
				: 'text-2xl'}"
		>
			{value}
		</p>
		{#if change}
			<p class="mt-1 flex items-center gap-1 text-xs tabular-nums {tone}">
				{#if change.direction !== 'flat'}
					<svg viewBox="0 0 10 10" class="size-2.5 fill-current" aria-hidden="true">
						{#if change.direction === 'up'}
							<path d="M5 1 9 8H1z" />
						{:else}
							<path d="M5 9 1 2h8z" />
						{/if}
					</svg>
				{/if}
				<span>{change.text}</span>
			</p>
		{/if}
		{#if note}
			<p class="mt-1 text-xs text-text-muted">{note}</p>
		{/if}
	{/if}
</div>
