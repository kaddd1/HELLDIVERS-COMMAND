<script lang="ts">
	import { STAT_DEFINITIONS } from '#lib/domain/statDefinitions.ts';
	import { getStatValue, type StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatDateTime, formatStatValue } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		snapshot: StatsSnapshot;
		playerName: string | null;
	}

	let { snapshot, playerName }: Props = $props();

	const t = ru.snapshots;
	const sourceLabel = $derived(
		{
			file: t.sourceFile,
			user: t.sourceUser,
			'import-time': t.sourceImport
		}[snapshot.capturedAtSource]
	);
</script>

<dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
	{#if playerName}
		<div class="flex justify-between gap-4 sm:col-span-2">
			<dt class="text-text-muted">{ru.data.inspect.player}</dt>
			<dd class="text-text">{playerName}</dd>
		</div>
	{/if}
	<div class="flex justify-between gap-4">
		<dt class="text-text-muted">{t.statsDate}</dt>
		<dd class="text-text tabular-nums">{formatDateTime(snapshot.capturedAt)}</dd>
	</div>
	<div class="flex justify-between gap-4">
		<dt class="text-text-muted">{t.importedAt}</dt>
		<dd class="text-text tabular-nums">{formatDateTime(snapshot.importedAt)}</dd>
	</div>
	<div class="flex justify-between gap-4">
		<dt class="text-text-muted">{t.dateSource}</dt>
		<dd class="text-text">{sourceLabel}</dd>
	</div>
</dl>

<table class="mt-4 w-full text-sm">
	<tbody>
		{#each STAT_DEFINITIONS as definition (definition.key)}
			{@const value =
				definition.key === 'level'
					? snapshot.stats.level
					: getStatValue(snapshot.stats, definition.key)}
			<tr class="border-b border-line/60">
				<th scope="row" class="py-2 pr-3 text-left font-normal text-text-muted">
					{definition.label}
				</th>
				<td class="py-2 text-right text-text tabular-nums">
					{value === null ? ru.compare.noValue : formatStatValue(definition.key, value)}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
