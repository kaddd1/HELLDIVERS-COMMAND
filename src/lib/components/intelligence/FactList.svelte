<script lang="ts">
	import type { Fact } from '#lib/analytics/portrait.ts';
	import { formatDecimal, formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		facts: Fact[];
	}

	let { facts }: Props = $props();

	const t = ru.intelligence.facts;
	const parts = ru.intelligence.composition.parts;

	const one = (n: number): string => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

	/** Every fact becomes a key figure and a short explanation. */
	function row(fact: Fact): { figure: string; label: string } {
		switch (fact.kind) {
			case 'killsPerDeath':
				return {
					figure: t.killsPerDeath.figure(formatDecimal(fact.value)),
					label: t.killsPerDeath.label
				};
			case 'hitsPer100':
				return { figure: t.hitsPer100.figure(fact.value), label: t.hitsPer100.label };
			case 'missionLength':
				return {
					figure: t.missionLength.figure(one(fact.minutes)),
					label: t.missionLength.label(
						fact.killsPerMinute === null ? null : one(fact.killsPerMinute)
					)
				};
			case 'failedMissions':
				return {
					figure: t.failedMissions.figure(fact.oneIn),
					label: t.failedMissions.label(formatInt(fact.failed))
				};
			case 'allMissionsCompleted':
				return { figure: t.allMissionsCompleted.figure, label: t.allMissionsCompleted.label };
			case 'favoriteFaction':
				return fact.even
					? { figure: t.evenFactions.figure, label: t.evenFactions.label }
					: {
							figure: t.favoriteFaction.figure(formatPercent(fact.share)),
							label: t.favoriteFaction.label(parts[fact.part as keyof typeof parts])
						};
			case 'methodShare':
				return {
					figure: t.methodShare.figure(fact.oneIn),
					label: t.methodShare.label(t.methodHow[fact.part as keyof typeof t.methodHow])
				};
			case 'friendlyFire':
				return {
					figure: t.friendlyFire.figure(fact.oneIn),
					label: t.friendlyFire.label(formatInt(fact.count))
				};
			case 'noFriendlyFire':
				return { figure: t.noFriendlyFire.figure, label: t.noFriendlyFire.label };
			case 'stratagems':
				return {
					figure: t.stratagems.figure(one(fact.perMission)),
					label: t.stratagems.label(
						fact.favorite ? parts[fact.favorite as keyof typeof parts] : null,
						fact.share === null ? null : formatPercent(fact.share)
					)
				};
			case 'objectives':
				return { figure: t.objectives.figure(one(fact.perMission)), label: t.objectives.label };
			case 'samples':
				return { figure: t.samples.figure(one(fact.perMission)), label: t.samples.label };
		}
	}
</script>

<ul class="grid gap-x-10 md:grid-cols-2">
	{#each facts as fact, index (index)}
		{@const item = row(fact)}
		<li
			class="grid min-h-16 animate-row grid-cols-[6.5rem_1fr] items-center gap-4 border-b border-line/60 py-3"
			style:animation-delay="{index * 50}ms"
		>
			<span
				class="font-display text-xl leading-tight font-bold whitespace-nowrap text-accent tabular-nums"
			>
				{item.figure}
			</span>
			<span class="text-sm leading-snug text-text">{item.label}</span>
		</li>
	{/each}
</ul>
