<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import {
		buildIntervals,
		compareSnapshots,
		filterRange,
		findAnomalies,
		type RangeId
	} from '#lib/analytics/history.ts';
	import FactionSection from '#lib/components/analytics/FactionSection.svelte';
	import CombatIntelligence from '#lib/components/intelligence/CombatIntelligence.svelte';
	import LifetimeTotals from '#lib/components/analytics/LifetimeTotals.svelte';
	import ProgressSection from '#lib/components/analytics/ProgressSection.svelte';
	import RatioSection from '#lib/components/analytics/RatioSection.svelte';
	import RecordsSection from '#lib/components/analytics/RecordsSection.svelte';
	import PageHeading from '#lib/components/layout/PageHeading.svelte';
	import SnapshotComparison from '#lib/components/snapshots/SnapshotComparison.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import HistoryNotice from '#lib/components/ui/HistoryNotice.svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import SegmentedControl from '#lib/components/ui/SegmentedControl.svelte';
	import { formatDate } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import { career } from '#lib/stores/career.svelte.ts';

	const t = ru.analytics;

	let range = $state<RangeId>('all');

	const inRange = $derived(filterRange(career.active, range));
	const anomalies = $derived(findAnomalies(buildIntervals(career.active)).length);
	const comparison = $derived(
		career.previous && career.latest ? compareSnapshots(career.previous, career.latest) : null
	);

	onMount(() => {
		void career.load();
	});
</script>

<svelte:head>
	<title>{ru.pages.analytics.title} — {ru.app.name}</title>
</svelte:head>

<PageHeading title={ru.pages.analytics.title} description={ru.pages.analytics.description} />

{#if career.status === 'error'}
	<p role="alert" class="border border-danger p-4 text-danger">{ru.career.storageError}</p>
{:else if career.status !== 'ready'}
	<p class="text-text-muted" aria-live="polite">{ru.common.loading}</p>
{:else if career.active.length === 0}
	<EmptyState title={t.empty.title} text={t.empty.text}>
		<a
			href={resolve('/')}
			class="inline-block border border-accent bg-accent px-4 py-2 font-display text-sm font-semibold tracking-widest text-accent-ink uppercase hover:bg-accent-strong"
		>
			{t.empty.link}
		</a>
	</EmptyState>
{:else if career.active.length === 1 && career.latest}
	<div class="space-y-6">
		<CombatIntelligence active={career.active} />
		<EmptyState title={t.single.title} text={t.single.text} />
		<Panel title={t.single.current}>
			<LifetimeTotals snapshot={career.latest} />
		</Panel>
	</div>
{:else}
	<div class="space-y-6">
		{#if anomalies > 0}
			<HistoryNotice
				title={t.issues.title}
				text={t.issues.text(anomalies)}
				linkLabel={t.issues.link}
			/>
		{/if}

		<div class="animate-reveal">
			<CombatIntelligence active={career.active} />
		</div>

		<div class="flex flex-wrap items-end justify-between gap-4">
			<SegmentedControl
				label={t.rangeLabel}
				bind:value={range}
				options={[
					{ value: '7', label: t.ranges['7'] },
					{ value: '30', label: t.ranges['30'] },
					{ value: '90', label: t.ranges['90'] },
					{ value: 'all', label: t.ranges.all }
				]}
			/>
			<p class="text-xs text-text-muted">
				{t.rangeNote}
				{#if inRange.length > 0}
					{formatDate(inRange[0].capturedAt)} — {formatDate(inRange.at(-1)!.capturedAt)}
				{/if}
			</p>
		</div>

		{#if inRange.length < 2}
			<p role="status" class="border-l-2 border-accent pl-3 text-sm text-text">
				{t.rangeEmpty}
			</p>
		{:else}
			<div class="animate-reveal">
				<ProgressSection snapshots={inRange} />
			</div>
			<div class="animate-reveal">
				<RatioSection snapshots={inRange} />
			</div>
			<div class="animate-reveal">
				<FactionSection snapshots={inRange} />
			</div>
		{/if}

		{#if comparison}
			<Panel title={t.comparison.title}>
				<SnapshotComparison interval={comparison} />
			</Panel>
		{/if}

		<RecordsSection snapshots={career.active} />
	</div>
{/if}
