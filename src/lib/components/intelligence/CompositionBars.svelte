<script lang="ts">
	import { onMount } from 'svelte';
	import { formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import type { Composition } from '#lib/analytics/profile.ts';

	interface Props {
		/** The composition of the period (or of the whole career). */
		period: Composition | null;
		/** The baseline to compare with; `null` hides the second row. */
		baseline: Composition | null;
		periodLabel: string;
	}

	let { period, baseline, periodLabel }: Props = $props();

	const t = ru.intelligence.composition;
	/** Segment fills: distinct in lightness so they stay apart on the dark background. */
	const FILLS = ['#f2c200', '#5aa9e6', '#e0533d', '#6fae5a', '#a98be0', '#e08a3c'];
	const OTHER_FILL = '#5b5f63';

	const partIds = $derived(period?.parts.map((p) => p.id) ?? []);

	function fill(id: string): string {
		return id === 'other'
			? OTHER_FILL
			: FILLS[partIds.filter((p) => p !== 'other').indexOf(id) % FILLS.length];
	}

	function label(id: string): string {
		return t.parts[id as keyof typeof t.parts];
	}

	let shown = $state(false);
	onMount(() => {
		const frame = requestAnimationFrame(() => (shown = true));
		return () => cancelAnimationFrame(frame);
	});

	const rows = $derived(
		[
			{ name: periodLabel, composition: period },
			...(baseline ? [{ name: t.baseline, composition: baseline }] : [])
		].filter((r) => r.composition !== null)
	);
</script>

{#if !period}
	<p class="text-sm text-text-muted">{t.none}</p>
{:else}
	<div class="space-y-3">
		{#each rows as row (row.name)}
			<div>
				<p class="mb-1 text-xs text-text-muted">{row.name}</p>
				<div
					class="flex h-5 overflow-hidden bg-surface-raised"
					role="img"
					aria-label={row
						.composition!.parts.map((p) => `${label(p.id)} ${formatPercent(p.share)}`)
						.join(', ')}
				>
					{#each row.composition!.parts as part (part.id)}
						<div
							class="h-full transition-[width] duration-700 ease-out"
							style:width="{shown ? part.share * 100 : 0}%"
							style:background-color={fill(part.id)}
						></div>
					{/each}
				</div>
			</div>
		{/each}

		<ul class="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-xs">
			{#each period.parts as part (part.id)}
				{@const before = baseline?.parts.find((p) => p.id === part.id)?.share}
				<li class="flex items-center gap-2 text-text-muted">
					<span class="size-2.5 shrink-0" style:background-color={fill(part.id)}></span>
					<span class="text-text">{label(part.id)}</span>
					<span class="tabular-nums">
						{formatPercent(part.share)}{#if before !== undefined}
							<span> ← {formatPercent(before)}</span>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}
