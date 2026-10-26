<script lang="ts">
	import { onMount } from 'svelte';
	import { buildIntervals, compareSnapshots, findAnomalies } from '#lib/analytics/history.ts';
	import CombatPanel from '#lib/components/career/CombatPanel.svelte';
	import ExtraStatsPanel from '#lib/components/career/ExtraStatsPanel.svelte';
	import KdPanel from '#lib/components/career/KdPanel.svelte';
	import MissionPanel from '#lib/components/career/MissionPanel.svelte';
	import PerformanceSummary from '#lib/components/career/PerformanceSummary.svelte';
	import ProfileHeader from '#lib/components/career/ProfileHeader.svelte';
	import ScreenshotImporter from '#lib/components/import/ScreenshotImporter.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import HistoryNotice from '#lib/components/ui/HistoryNotice.svelte';
	import { ru } from '#lib/i18n/ru.ts';
	import { career } from '#lib/stores/career.svelte.ts';

	let formOpen = $state(false);

	const interval = $derived(
		career.previous && career.latest ? compareSnapshots(career.previous, career.latest) : null
	);
	const anomalies = $derived(findAnomalies(buildIntervals(career.active)).length);

	// Data lives in the browser's IndexedDB, so it can only be read on the client.
	onMount(() => {
		void career.load();
	});
</script>

<svelte:head>
	<title>{ru.pages.career.title} — {ru.app.name}</title>
</svelte:head>

{#if career.status === 'error'}
	<p role="alert" class="border border-danger p-4 text-danger">{ru.career.storageError}</p>
{:else if career.status !== 'ready'}
	<p class="text-text-muted" aria-live="polite">{ru.common.loading}</p>
{:else if career.latest}
	{@const latest = career.latest}
	<div class="space-y-6">
		<div class="animate-reveal">
			<ProfileHeader
				profile={career.profile}
				snapshot={latest}
				snapshotCount={career.snapshots.length}
				{formOpen}
				ontoggle={() => (formOpen = !formOpen)}
			/>
		</div>

		{#if formOpen}
			<div class="animate-reveal">
				<ScreenshotImporter
					onsaved={() => (formOpen = false)}
					oncancel={() => (formOpen = false)}
				/>
			</div>
		{/if}

		{#if anomalies > 0}
			<HistoryNotice
				title={ru.overview.anomalyBanner.title}
				text={ru.overview.anomalyBanner.text}
				linkLabel={ru.overview.anomalyBanner.link}
			/>
		{/if}

		<div class="animate-reveal" style:animation-delay="80ms">
			<PerformanceSummary {latest} {interval} />
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<div class="animate-reveal" style:animation-delay="160ms">
				<KdPanel stats={latest.stats} />
			</div>
			<div class="animate-reveal" style:animation-delay="240ms">
				<MissionPanel stats={latest.stats} />
			</div>
		</div>

		<div class="animate-reveal" style:animation-delay="320ms">
			<CombatPanel stats={latest.stats} />
		</div>

		<div class="animate-reveal" style:animation-delay="400ms">
			<ExtraStatsPanel stats={latest.stats} />
		</div>
	</div>
{:else}
	<div class="space-y-6">
		<EmptyState title={ru.career.empty.title} text={ru.career.empty.text} />
		<ScreenshotImporter />
	</div>
{/if}
