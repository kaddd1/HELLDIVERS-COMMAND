<script lang="ts">
	import { computeRecords } from '#lib/analytics/records.ts';
	import Panel from '#lib/components/ui/Panel.svelte';
	import type { StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatDate, formatDecimal, formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import LifetimeTotals from './LifetimeTotals.svelte';

	interface Props {
		snapshots: StatsSnapshot[];
	}

	let { snapshots }: Props = $props();

	const t = ru.analytics.records;
	const records = $derived(computeRecords(snapshots));
	const latest = $derived(snapshots.at(-1) ?? null);

	function format(value: number, kind: 'int' | 'decimal' | 'percent'): string {
		return kind === 'int'
			? formatInt(Math.round(value))
			: kind === 'percent'
				? formatPercent(value)
				: formatDecimal(value);
	}
</script>

<Panel title={t.title}>
	<div class="space-y-6">
		{#if latest}
			<section>
				<h3
					class="border-b border-accent pb-1 font-display text-sm font-semibold tracking-widest text-accent uppercase"
				>
					{t.lifetime}
				</h3>
				<p class="mt-2 mb-3 text-xs text-text-muted">{t.lifetimeNote}</p>
				<LifetimeTotals snapshot={latest} />
			</section>
		{/if}

		<section>
			<h3
				class="border-b border-accent pb-1 font-display text-sm font-semibold tracking-widest text-accent uppercase"
			>
				{t.intervals}
			</h3>
			<p class="mt-2 mb-3 text-xs text-text-muted">{t.intervalNote}</p>

			{#if records.length === 0}
				<p class="text-sm text-text-muted">{t.none}</p>
			{:else}
				<ul class="grid gap-3 md:grid-cols-2">
					{#each records as record (record.id)}
						<li class="border-l-2 border-accent bg-surface-raised px-4 py-3">
							<p class="text-sm text-text-muted">{t.names[record.id]}</p>
							<p class="mt-1 font-display text-2xl font-bold text-text tabular-nums">
								{format(record.value, record.format)}
							</p>
							<p class="mt-1 text-xs text-text-muted">
								{#if record.from}
									{t.between(formatDate(record.from.capturedAt), formatDate(record.to.capturedAt))}
								{:else}
									{t.onDate(formatDate(record.to.capturedAt))}
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</Panel>
