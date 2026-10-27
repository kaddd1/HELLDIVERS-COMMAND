<script lang="ts">
	import { buildPeriodOptions } from '#lib/analytics/profile.ts';
	import Panel from '#lib/components/ui/Panel.svelte';
	import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
	import type { StatsSnapshot } from '#lib/domain/stats.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import PeriodView from './PeriodView.svelte';
	import PortraitView from './PortraitView.svelte';

	interface Props {
		/** Snapshots used by analytics, oldest first. */
		active: StatsSnapshot[];
	}

	let { active }: Props = $props();

	const t = ru.intelligence;

	let requested = $state<'career' | 'period'>('career');

	const latest = $derived(active.at(-1) ?? null);
	const periods = $derived(buildPeriodOptions(active));
	const mode = $derived(requested === 'period' && periods.length > 0 ? 'period' : 'career');
	const modes = $derived(
		periods.length > 0
			? [
					{ value: 'career' as const, label: t.modes.career },
					{ value: 'period' as const, label: t.modes.period }
				]
			: []
	);
</script>

{#if latest}
	<Panel title="{t.title} · {t.subtitle}">
		<div class="space-y-6">
			<div class="flex flex-wrap items-end justify-between gap-4">
				<h2 class="font-display text-2xl font-bold tracking-wide text-text uppercase">
					{mode === 'career' ? t.career.heading : t.modes.period}
				</h2>
				{#if modes.length > 0}
					<SegmentedControl label={t.modes.label} bind:value={requested} options={modes} />
				{/if}
			</div>

			{#if mode === 'career'}
				<PortraitView snapshot={latest} />
				{#if active.length > 1 && periods.length === 0}
					<p class="border-l-2 border-danger pl-3 text-sm text-text-muted">
						{t.period.noPeriods.text}
					</p>
				{:else if active.length === 1}
					<p class="text-xs text-text-muted">{t.periodHint}</p>
				{/if}
			{:else}
				<PeriodView options={periods} />
			{/if}
		</div>
	</Panel>
{/if}
