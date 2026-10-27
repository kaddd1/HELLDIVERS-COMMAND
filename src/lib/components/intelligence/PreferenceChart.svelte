<script lang="ts">
	import { linear } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';
	import { partColor } from '#lib/analytics/profileCharts.ts';
	import type { Composition, CompositionId } from '#lib/analytics/profile.ts';
	import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
	import { formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import DonutPanel from './DonutPanel.svelte';

	interface Props {
		compositions: Composition[];
	}

	let { compositions }: Props = $props();

	const t = ru.intelligence;
	const names = ru.intelligence.composition.parts;
	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	/** The old chart fades out this fast; the new one starts drawing right after. */
	const EXIT_MS = reduced ? 0 : 150;
	const NEXT_DELAY_MS = reduced ? 0 : 170;

	let chosen = $state<CompositionId>('factions');
	/** False until the first tab change, so the very first chart appears without a pause. */
	let switched = $state(false);
	let initialized = false;

	$effect.pre(() => {
		void chosen;
		if (initialized) switched = true;
		initialized = true;
	});

	const current = $derived(compositions.find((c) => c.id === chosen) ?? compositions[0] ?? null);
	const tabs = $derived(
		compositions.map((c) => ({ value: c.id, label: t.preferences.tabs[c.id] }))
	);

	/** A plain fade: the previous chart just goes away instead of turning into the next one. */
	function fadeOut(node: HTMLElement): TransitionConfig {
		node.style.willChange = 'opacity';
		return { duration: EXIT_MS, easing: linear, css: (progress) => `opacity:${progress};` };
	}
</script>

{#if !current}
	<p class="text-sm text-text-muted">{t.preferences.none}</p>
{:else}
	<div class="space-y-5">
		<SegmentedControl label={t.preferences.show} bind:value={chosen} options={tabs} />

		<div class="grid min-h-[17rem] items-center gap-6 sm:grid-cols-[16rem_1fr]">
			<div class="relative mx-auto h-64 w-64 max-w-full">
				<!-- Keyed each instead of {#key}: a fading chart keeps its own data instead of following the new tab. -->
				{#each [current] as shown (shown.id)}
					<div class="absolute inset-0" out:fadeOut>
						<DonutPanel
							composition={shown}
							animate={!reduced}
							delay={switched ? NEXT_DELAY_MS : 0}
						/>
					</div>
				{/each}
			</div>

			<div class="grid">
				{#each [current] as shown (shown.id)}
					<ul class="space-y-3 [grid-area:1/1]" out:fadeOut>
						{#each shown.parts as part, index (part.id)}
							{@const color = partColor(shown.id, part.id)}
							{@const base = (switched ? NEXT_DELAY_MS : 0) + index * 70}
							<li class="animate-row" style:animation-delay="{base}ms">
								<div class="flex items-center gap-3 text-sm">
									<span class="size-3 shrink-0" style:background-color={color}></span>
									<span class="flex-1 text-text">{names[part.id as keyof typeof names]}</span>
									<span class="font-display font-semibold text-text tabular-nums">
										{formatPercent(part.share)}
									</span>
									<span class="w-20 text-right text-xs text-text-muted tabular-nums">
										{formatInt(part.value)}
									</span>
								</div>
								<div class="mt-1.5 h-1 bg-surface-raised">
									<div
										class="h-full origin-left animate-grow"
										style:width="{(part.share * 100).toFixed(2)}%"
										style:background-color={color}
										style:animation-delay="{base + 100}ms"
									></div>
								</div>
							</li>
						{/each}
					</ul>
				{/each}
			</div>
		</div>
		{#if current.id === 'methods'}
			<p class="animate-reveal text-xs text-text-muted">{t.preferences.otherNote}</p>
		{/if}
	</div>
{/if}
