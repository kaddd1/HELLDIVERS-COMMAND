<script lang="ts">
	import type { Interval } from '#lib/analytics/history.ts';
	import { RATIOS } from '#lib/analytics/metrics.ts';
	import { STAT_DEFINITIONS, getDefinition } from '#lib/domain/statDefinitions.ts';
	import { toStatValues } from '#lib/domain/stats.ts';
	import {
		formatDateTime,
		formatElapsed,
		formatPercent,
		formatRatio,
		formatStatValue,
		changeOfRatio
	} from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		interval: Interval;
	}

	let { interval }: Props = $props();

	const t = ru.compare;
	const before = $derived(toStatValues(interval.from.stats));
	const after = $derived(toStatValues(interval.to.stats));
	const comparable = $derived(interval.status === 'ok');

	const rows = $derived(
		STAT_DEFINITIONS.map((definition) => {
			const a = before[definition.key];
			const b = after[definition.key];
			const delta = interval.deltas[definition.key];
			return {
				key: definition.key,
				label: definition.label,
				before: a === undefined ? t.noValue : formatStatValue(definition.key, a),
				after: b === undefined ? t.noValue : formatStatValue(definition.key, b),
				delta: delta === undefined ? null : formatStatValue(definition.key, delta),
				percent: a !== undefined && delta !== undefined && a > 0 ? delta / a : null,
				changed: delta !== undefined && delta > 0
			};
		})
	);

	const ratioRows = $derived(
		RATIOS.map((ratio) => {
			const a = ratio.compute(before);
			const b = ratio.compute(after);
			const period = comparable ? ratio.compute(interval.deltas) : null;
			return {
				id: ratio.id,
				format: ratio.format,
				before: formatRatio(a, ratio.format),
				after: formatRatio(b, ratio.format),
				change: comparable ? changeOfRatio(b, a, ratio.format) : null,
				period: period === null ? t.noValue : formatRatio(period, ratio.format)
			};
		})
	);

	const counters = $derived(interval.decreased.map((key) => getDefinition(key).label).join(', '));
</script>

<div class="space-y-5">
	<p class="text-sm text-text-muted">
		{formatDateTime(interval.from.capturedAt)} → {formatDateTime(interval.to.capturedAt)}
		· {ru.analytics.comparison.elapsed}: {formatElapsed(interval.seconds)}
	</p>

	{#if interval.status === 'reset'}
		<p role="status" class="border-l-2 border-accent pl-3 text-sm text-text">{t.resetNotice}</p>
	{:else if interval.status === 'anomaly'}
		<p role="status" class="border-l-2 border-danger pl-3 text-sm text-danger">
			{t.anomalyNotice(counters)}
		</p>
	{/if}

	<div class="overflow-x-auto">
		<table class="w-full min-w-[34rem] text-sm">
			<thead>
				<tr
					class="border-b border-line text-left font-display text-xs tracking-widest text-text-muted uppercase"
				>
					<th scope="col" class="py-2 pr-3 font-semibold">{t.stat}</th>
					<th scope="col" class="px-3 py-2 text-right font-semibold">{t.before}</th>
					<th scope="col" class="px-3 py-2 text-right font-semibold">{t.after}</th>
					<th scope="col" class="px-3 py-2 text-right font-semibold">{t.change}</th>
					<th scope="col" class="py-2 pl-3 text-right font-semibold">{t.percent}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.key)}
					<tr class="border-b border-line/60">
						<th scope="row" class="py-2 pr-3 text-left font-normal text-text-muted">{row.label}</th>
						<td class="px-3 py-2 text-right tabular-nums">{row.before}</td>
						<td class="px-3 py-2 text-right text-text tabular-nums">{row.after}</td>
						<td
							class="px-3 py-2 text-right tabular-nums {row.changed
								? 'text-accent'
								: 'text-text-muted'}"
						>
							{#if row.delta === null}
								{t.noValue}
							{:else if row.changed}
								+{row.delta}
							{:else}
								<span class="text-xs">{t.unchanged}</span>
							{/if}
						</td>
						<td class="py-2 pl-3 text-right text-text-muted tabular-nums">
							{row.percent === null || !row.changed ? t.noValue : `+${formatPercent(row.percent)}`}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<div class="overflow-x-auto">
		<table class="w-full min-w-[34rem] text-sm">
			<caption class="pb-2 text-left font-display text-xs tracking-widest text-accent uppercase">
				{t.ratios}
			</caption>
			<thead>
				<tr
					class="border-b border-line text-left font-display text-xs tracking-widest text-text-muted uppercase"
				>
					<th scope="col" class="py-2 pr-3 font-semibold">{t.stat}</th>
					<th scope="col" class="px-3 py-2 text-right font-semibold">{t.before}</th>
					<th scope="col" class="px-3 py-2 text-right font-semibold">{t.after}</th>
					<th scope="col" class="px-3 py-2 text-right font-semibold">{t.change}</th>
					<th scope="col" class="py-2 pl-3 text-right font-semibold">{t.forInterval}</th>
				</tr>
			</thead>
			<tbody>
				{#each ratioRows as row (row.id)}
					<tr class="border-b border-line/60">
						<th scope="row" class="py-2 pr-3 text-left font-normal text-text-muted">
							{ru.analytics.ratios.names[row.id]}
						</th>
						<td class="px-3 py-2 text-right tabular-nums">{row.before}</td>
						<td class="px-3 py-2 text-right text-text tabular-nums">{row.after}</td>
						<td
							class="px-3 py-2 text-right tabular-nums {row.change?.direction === 'up'
								? 'text-ok'
								: row.change?.direction === 'down'
									? 'text-danger'
									: 'text-text-muted'}"
						>
							{row.change?.text ?? t.noValue}
						</td>
						<td class="py-2 pl-3 text-right text-text tabular-nums">{row.period}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
