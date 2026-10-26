<script lang="ts">
	import MetricTile from '#lib/components/ui/MetricTile.svelte';
	import { getDefinition, type StatKey } from '#lib/domain/statDefinitions.ts';
	import { getStatValue, type StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatStatValue } from '#lib/format.ts';

	interface Props {
		snapshot: StatsSnapshot;
	}

	let { snapshot }: Props = $props();

	const KEYS: StatKey[] = [
		'kills',
		'deaths',
		'missionsPlayed',
		'missionsCompleted',
		'objectivesCompleted',
		'successfulExtractions',
		'samplesCollected',
		'stratagemsUsed',
		'timeInMissions',
		'totalXp'
	];

	const tiles = $derived(
		KEYS.map((key) => {
			const value = getStatValue(snapshot.stats, key);
			return {
				key,
				label: getDefinition(key).label,
				value: value === null ? null : formatStatValue(key, value)
			};
		})
	);
</script>

<div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
	{#each tiles as tile (tile.key)}
		<MetricTile label={tile.label} value={tile.value} />
	{/each}
</div>
