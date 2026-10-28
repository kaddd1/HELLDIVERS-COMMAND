<script lang="ts">
	import { resolve } from '$app/paths';
	import { buildIntervals, type Interval } from '#lib/analytics/history.ts';
	import { getRatio } from '#lib/analytics/metrics.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { toStatValues, type StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatDateTime, formatDecimal, formatInt } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		snapshots: StatsSnapshot[];
		active: StatsSnapshot[];
		selected: string[];
		onselect: (id: string, selected: boolean) => void;
		oninspect: (snapshot: StatsSnapshot) => void;
		ondelete: (snapshot: StatsSnapshot) => void;
		onupdate: (id: string, patch: { resetConfirmed?: boolean; excluded?: boolean }) => void;
	}

	let { snapshots, active, selected, onselect, oninspect, ondelete, onupdate }: Props = $props();

	const t = ru.data.list;
	const s = ru.snapshots;

	const intervalTo = $derived(
		new Map<string, Interval>(buildIntervals(active).map((interval) => [interval.to.id, interval]))
	);
</script>

{#if snapshots.length === 0}
	<div class="border border-dashed border-line p-8 text-center">
		<p class="text-text-muted">{t.empty}</p>
		<a
			href={resolve('/')}
			class="mt-3 inline-block font-display text-xs tracking-widest text-accent uppercase underline underline-offset-4"
		>
			{t.emptyLink}
		</a>
	</div>
{:else}
	<p class="mb-3 text-xs text-text-muted">{t.selectHint}</p>
	<ul class="divide-y divide-line border border-line">
		{#each snapshots as snapshot (snapshot.id)}
			{@const interval = intervalTo.get(snapshot.id)}
			{@const values = toStatValues(snapshot.stats)}
			{@const checked = selected.includes(snapshot.id)}
			<li class="bg-surface p-4 {snapshot.excluded ? 'opacity-60' : ''}">
				<div class="flex flex-wrap items-start gap-x-4 gap-y-3">
					<label class="flex items-center pt-1">
						<input
							type="checkbox"
							{checked}
							disabled={!checked && selected.length >= 2}
							aria-label="{t.select}: {formatDateTime(snapshot.capturedAt)}"
							onchange={(event) => onselect(snapshot.id, event.currentTarget.checked)}
							class="size-4 accent-accent"
						/>
					</label>

					<div class="min-w-0 flex-1">
						<p class="font-display text-base font-semibold text-text tabular-nums">
							{formatDateTime(snapshot.capturedAt)}
						</p>
						<p class="text-xs text-text-muted">
							{s.importedAt}: {formatDateTime(snapshot.importedAt)}
						</p>
						<p class="mt-2 text-sm text-text-muted tabular-nums">
							{t.kills}
							{values.kills === undefined ? '—' : formatInt(values.kills)}
							· {t.deaths}
							{values.deaths === undefined ? '—' : formatInt(values.deaths)}
							· K/D {formatDecimal(getRatio('kd').compute(values))}
							· {t.missions}
							{values.missionsPlayed === undefined ? '—' : formatInt(values.missionsPlayed)}
						</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#if snapshot.resetConfirmed}
								<Badge tone="accent">{s.resetBadge}</Badge>
							{/if}
							{#if interval?.status === 'anomaly'}
								<Badge tone="danger">{s.anomalyBadge}</Badge>
							{/if}
							{#if snapshot.excluded}
								<Badge>{s.excludedBadge}</Badge>
							{/if}
						</div>
					</div>

					<!-- On phones the buttons take their own row, aligned with the text above. -->
					<div class="flex flex-wrap gap-2 max-sm:basis-full max-sm:pl-8">
						<Button variant="secondary" size="sm" onclick={() => oninspect(snapshot)}>
							{t.inspect}
						</Button>
						<Button variant="secondary" size="sm" onclick={() => ondelete(snapshot)}>
							{t.delete}
						</Button>
					</div>
				</div>

				{#if interval?.status === 'anomaly'}
					<div class="mt-3 border-l-2 border-danger pl-3">
						<p class="text-xs text-text-muted">{t.anomalyHelp}</p>
						<div class="mt-2 flex flex-wrap gap-2">
							<Button size="sm" onclick={() => onupdate(snapshot.id, { resetConfirmed: true })}>
								{t.markReset}
							</Button>
							<Button
								variant="secondary"
								size="sm"
								onclick={() => onupdate(snapshot.id, { excluded: true })}
							>
								{t.exclude}
							</Button>
						</div>
					</div>
				{:else if snapshot.resetConfirmed}
					<div class="mt-3">
						<Button
							variant="secondary"
							size="sm"
							onclick={() => onupdate(snapshot.id, { resetConfirmed: false })}
						>
							{t.unmarkReset}
						</Button>
					</div>
				{/if}

				{#if snapshot.excluded}
					<div class="mt-3">
						<Button
							variant="secondary"
							size="sm"
							onclick={() => onupdate(snapshot.id, { excluded: false })}
						>
							{t.include}
						</Button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
