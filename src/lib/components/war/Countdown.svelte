<script lang="ts">
	import { ru } from '#lib/i18n/ru.ts';
	import { remainingTime } from '#lib/war/majorOrders.ts';

	interface Props {
		expiresAt: string | null;
		/** Current time in milliseconds, already corrected for the server clock. */
		now: number;
	}

	let { expiresAt, now }: Props = $props();

	const t = ru.war.countdown;
	const remaining = $derived(remainingTime(expiresAt, now));
	const pad = (n: number): string => String(n).padStart(2, '0');

	const segments = $derived(
		remaining
			? [
					{ key: 'days', value: String(remaining.days), unit: t.unit.days },
					{ key: 'hours', value: pad(remaining.hours), unit: t.unit.hours },
					{ key: 'minutes', value: pad(remaining.minutes), unit: t.unit.minutes },
					{ key: 'seconds', value: pad(remaining.seconds), unit: t.unit.seconds }
				]
			: []
	);
	const spoken = $derived(
		remaining
			? `${remaining.days} ${t.unit.days}, ${remaining.hours} ${t.unit.hours}, ${remaining.minutes} ${t.unit.minutes}`
			: ''
	);
</script>

<div>
	<p class="font-display text-xs tracking-widest text-text-muted uppercase">{t.label}</p>
	{#if remaining === null}
		<p class="mt-2 text-text-muted">{t.noDeadline}</p>
	{:else if remaining.totalMs === 0}
		<p class="mt-2 font-display text-xl font-bold tracking-widest text-danger uppercase">
			{t.expired}
		</p>
	{:else}
		<div role="timer" aria-label={t.aria(spoken)} class="mt-2 flex gap-2">
			{#each segments as segment (segment.key)}
				<div class="min-w-16 border border-line bg-bg px-3 py-2 text-center">
					<span class="block font-mono text-3xl leading-none font-bold text-accent tabular-nums">
						{segment.value}
					</span>
					<span
						class="mt-1 block font-display text-[0.65rem] tracking-widest text-text-muted uppercase"
					>
						{segment.unit}
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
