<script lang="ts">
	import { formatPercent, formatRatio } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import { getMetric, type Insight } from '#lib/analytics/profile.ts';

	interface Props {
		insights: Insight[];
	}

	let { insights }: Props = $props();

	const t = ru.intelligence.insights;
	const c = ru.intelligence.composition;

	function text(insight: Insight): string {
		switch (insight.kind) {
			case 'style':
				return t.style[insight.id];
			case 'metric': {
				const definition = getMetric(insight.id);
				return t.metric(
					ru.intelligence.metrics[insight.id].name,
					insight.direction,
					formatRatio(insight.period, definition.format),
					formatRatio(insight.baseline, definition.format),
					formatPercent(Math.abs(insight.change))
				);
			}
			case 'shift':
				return t.shift(
					c.groups[insight.group],
					c.parts[insight.part as keyof typeof c.parts],
					insight.to >= insight.from,
					formatPercent(insight.from),
					formatPercent(insight.to)
				);
			case 'stable':
				return t.stable;
			case 'notEnough':
				return t.notEnough(insight.reliable);
		}
	}

	function direction(insight: Insight): 'up' | 'down' | null {
		if (insight.kind === 'metric') return insight.direction === 'higher' ? 'up' : 'down';
		if (insight.kind === 'shift') return insight.to >= insight.from ? 'up' : 'down';
		return null;
	}
</script>

<ul class="space-y-3">
	{#each insights as insight, index (index)}
		{@const arrow = direction(insight)}
		<li
			class="flex gap-3 border-l-2 py-1 pl-3 text-sm {insight.kind === 'style'
				? 'border-accent text-text'
				: 'border-line text-text-muted'}"
		>
			{#if arrow}
				<svg viewBox="0 0 10 10" class="mt-1 size-2.5 shrink-0 fill-accent" aria-hidden="true">
					{#if arrow === 'up'}
						<path d="M5 1 9 8H1z" />
					{:else}
						<path d="M5 9 1 2h8z" />
					{/if}
				</svg>
			{/if}
			<span>{text(insight)}</span>
		</li>
	{/each}
</ul>
<p class="mt-4 text-xs text-text-muted">{t.disclaimer}</p>
