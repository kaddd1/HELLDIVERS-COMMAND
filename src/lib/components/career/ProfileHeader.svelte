<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { successRate, type PlayerProfile, type StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatDateTime, formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		profile: PlayerProfile | null;
		snapshot: StatsSnapshot;
		snapshotCount: number;
		formOpen: boolean;
		ontoggle: () => void;
	}

	let { profile, snapshot, snapshotCount, formOpen, ontoggle }: Props = $props();

	const t = ru.career;
	const o = ru.overview;
	const stats = $derived(snapshot.stats);
	const rate = $derived(successRate(stats));
</script>

<section class="border border-l-4 border-line border-l-accent bg-surface p-5">
	<div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex items-center gap-5">
			<div
				class="flex size-20 shrink-0 flex-col items-center justify-center border border-accent bg-bg"
				aria-label="{t.level} {stats.level}"
			>
				<span class="font-display text-[0.65rem] tracking-widest text-text-muted uppercase">
					{t.level}
				</span>
				<span class="font-display text-3xl leading-none font-bold text-accent tabular-nums">
					{stats.level}
				</span>
			</div>
			<div class="min-w-0">
				<h1 class="font-display text-2xl font-bold tracking-wide break-words text-text uppercase">
					{profile?.displayName ?? o.callsignUnknown}
				</h1>
				<p class="mt-1 text-sm text-text-muted">
					{o.rank}:
					{#if stats.rankTitle}
						<span class="font-display tracking-widest text-accent uppercase">{stats.rankTitle}</span
						>
					{:else}
						<span title={o.rankHint}>{o.rankUnavailable}</span>
					{/if}
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
					<Badge>{t.sourceBadge[snapshot.source]}</Badge>
					<span class="text-xs text-text-muted">{o.snapshotCount(snapshotCount)}</span>
				</div>
			</div>
		</div>

		<div class="shrink-0">
			<Button variant={formOpen ? 'secondary' : 'primary'} onclick={ontoggle}>
				{formOpen ? t.closeForm : t.updateAction}
			</Button>
		</div>
	</div>

	<dl class="mt-5 grid gap-x-8 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-2">
		<div class="flex justify-between gap-4">
			<dt class="text-text-muted">{o.statsDate}</dt>
			<dd class="text-text tabular-nums">{formatDateTime(snapshot.capturedAt)}</dd>
		</div>
		<div class="flex justify-between gap-4">
			<dt class="text-text-muted">{o.importedAt}</dt>
			<dd class="text-text tabular-nums">{formatDateTime(snapshot.importedAt)}</dd>
		</div>
	</dl>

	<p class="mt-3 text-sm text-text-muted">
		{o.summary({
			missions: formatInt(stats.missionsPlayed),
			rate: formatPercent(rate),
			kills: formatInt(stats.kills),
			deaths: formatInt(stats.deaths)
		})}
	</p>
</section>
