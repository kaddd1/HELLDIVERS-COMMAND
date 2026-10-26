<script lang="ts">
	import { onMount } from 'svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import type { ExtraStatKey } from '#lib/domain/statDefinitions.ts';
	import { getDefinition } from '#lib/domain/statDefinitions.ts';
	import type { PlayerStats } from '#lib/domain/stats.ts';
	import { formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		stats: PlayerStats;
	}

	let { stats }: Props = $props();

	const t = ru.extra;

	const factions = $derived(
		(
			[
				['killsBugs', t.bugs],
				['killsAutomatons', t.automatons],
				['killsIlluminate', t.illuminate]
			] as const
		).flatMap(([key, label]) => {
			const value = stats.extra[key];
			return value === undefined ? [] : [{ key, label, value }];
		})
	);
	const factionTotal = $derived(factions.reduce((sum, f) => sum + f.value, 0));

	function list(keys: ExtraStatKey[]): { key: ExtraStatKey; label: string; value: number }[] {
		return keys.flatMap((key) => {
			const value = stats.extra[key];
			return value === undefined ? [] : [{ key, label: getDefinition(key).label, value }];
		});
	}

	const sections = $derived(
		[
			{
				title: t.methods,
				items: list(['grenadeKills', 'meleeKills', 'eagleKills', 'friendlyKills'])
			},
			{
				title: t.stratagems,
				items: list([
					'orbitalStratagems',
					'defensiveStratagems',
					'eagleStratagems',
					'supplyStratagems',
					'reinforcementStratagems',
					'stratagemsUsed'
				])
			},
			{
				title: t.operations,
				items: list(['successfulExtractions', 'objectivesCompleted', 'samplesCollected', 'totalXp'])
			}
		].filter((section) => section.items.length > 0)
	);

	let shown = $state(false);
	onMount(() => {
		const frame = requestAnimationFrame(() => (shown = true));
		return () => cancelAnimationFrame(frame);
	});
</script>

{#if factions.length > 0 || sections.length > 0}
	<div class="grid gap-6 lg:grid-cols-2">
		{#if factions.length > 0}
			<Panel title={t.factions}>
				<ul class="space-y-4">
					{#each factions as faction (faction.key)}
						{@const share = factionTotal > 0 ? faction.value / factionTotal : 0}
						<li>
							<div class="flex items-baseline justify-between gap-3">
								<span class="text-sm text-text-muted">{faction.label}</span>
								<span class="font-display text-lg font-semibold tabular-nums">
									{formatInt(faction.value)}
									<span class="text-xs font-normal text-text-muted">{formatPercent(share)}</span>
								</span>
							</div>
							<div class="mt-1 h-2 bg-surface-raised">
								<div
									class="h-full bg-accent transition-[width] duration-700 ease-out"
									style:width="{shown ? share * 100 : 0}%"
								></div>
							</div>
						</li>
					{/each}
				</ul>
			</Panel>
		{/if}

		{#each sections as section (section.title)}
			<Panel title={section.title}>
				<dl class="grid gap-3 text-sm">
					{#each section.items as item (item.key)}
						<div class="flex items-baseline justify-between gap-4 border-b border-line pb-2">
							<dt class="text-text-muted">{item.label}</dt>
							<dd class="font-display text-lg font-semibold tabular-nums">
								{formatInt(item.value)}
							</dd>
						</div>
					{/each}
				</dl>
			</Panel>
		{/each}
	</div>
{/if}
