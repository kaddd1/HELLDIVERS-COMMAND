<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import StatTile from '#lib/components/ui/StatTile.svelte';
	import { STAT_DEFINITIONS, type StatGroup, type StatKey } from '#lib/domain/statDefinitions.ts';
	import { accuracy, kdRatio, successRate } from '#lib/domain/stats.ts';
	import { formatDecimal, formatPercent } from '#lib/format.ts';
	import { formatDateTime } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import type { ImportSession } from '#lib/stores/importSession.svelte.ts';
	import StatRow from './StatRow.svelte';

	interface Props {
		session: ImportSession;
		onsaved: () => void;
	}

	let { session, onsaved }: Props = $props();

	const t = ru.importer.review;
	const d = ru.importer.date;
	const r = ru.importer.reset;
	const GROUPS: StatGroup[] = ['profile', 'kills', 'combat', 'stratagems', 'missions'];

	const rows = $derived(
		GROUPS.map((group) => ({
			group,
			stats: session.resolved.filter(
				(stat) => STAT_DEFINITIONS.find((d) => d.key === stat.key)?.group === group
			)
		}))
	);

	const reliable = $derived(
		session.resolved.filter((s) => s.state === 'ok' || s.state === 'confirmed').length
	);

	const flags = $derived.by(() => {
		const found: Partial<Record<StatKey, 'error' | 'warning'>> = {};
		for (const issue of session.issues) {
			for (const key of issue.keys) {
				if (found[key] !== 'error') found[key] = issue.severity;
			}
		}
		return found;
	});

	async function save(): Promise<void> {
		if (await session.save()) onsaved();
	}
</script>

<Panel title={t.title}>
	<div class="space-y-6">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="max-w-2xl text-sm text-text-muted">{t.lead}</p>
			<div class="flex flex-wrap gap-2">
				<Badge>{t.recognized(reliable, session.resolved.length)}</Badge>
				{#if session.blocking.length > 0}
					<Badge tone="danger">{t.needAction(session.blocking.length)}</Badge>
				{/if}
			</div>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<Field label={t.name} bind:value={session.displayName} hint={t.nameHint} maxlength={40} />

			<div>
				<label
					for="stats-date"
					class="block font-display text-xs tracking-widest text-text-muted uppercase"
				>
					{d.title}
				</label>
				<input
					id="stats-date"
					type="datetime-local"
					bind:value={session.statsDate}
					aria-describedby="stats-date-hint"
					aria-invalid={session.capturedAt ? undefined : 'true'}
					class="mt-1 block w-full border bg-bg px-3 py-2 text-text {session.capturedAt
						? 'border-line'
						: 'border-danger'}"
				/>
				<p id="stats-date-hint" class="mt-1 text-xs text-text-muted">{d.hint}</p>
				{#if session.datesDiffer}
					<div class="mt-2 border-l-2 border-accent pl-3">
						<p class="text-xs text-text">{d.differ}</p>
						<div class="mt-2 flex flex-wrap gap-2">
							{#each session.fileDates as fileDate, index (index)}
								{#if fileDate}
									<Button variant="secondary" size="sm" onclick={() => session.useFileDate(index)}>
										{d.useFile(index + 1, formatDateTime(fileDate.toISOString()))}
									</Button>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>

		{#if session.possibleReset}
			<div class="border border-l-4 border-danger/60 border-l-danger p-4">
				<p class="font-display text-sm font-semibold tracking-widest text-danger uppercase">
					{r.title}
				</p>
				<p class="mt-1 text-sm text-text-muted">{r.text}</p>
				<label class="mt-3 flex items-start gap-3 text-sm text-text">
					<input
						type="checkbox"
						bind:checked={session.markReset}
						class="mt-1 size-4 accent-accent"
					/>
					<span>{r.checkbox}</span>
				</label>
				<p class="mt-2 text-xs text-text-muted">{r.hint}</p>
			</div>
		{/if}

		{#each rows as { group, stats } (group)}
			<section>
				<h3
					class="border-b border-accent pb-1 font-display text-sm font-semibold tracking-widest text-accent uppercase"
				>
					{t.groups[group]}
				</h3>
				<ul>
					{#each stats as stat (stat.key)}
						<StatRow
							{stat}
							flag={flags[stat.key] ?? null}
							onchoose={(value) => session.choose(stat.key, value)}
							onconfirm={() => session.confirm(stat.key)}
							onedit={(text) => session.edit(stat.key, text)}
							onundo={() => session.undo(stat.key)}
						/>
					{/each}
				</ul>
			</section>
		{/each}

		{#if session.stats}
			<section>
				<h3
					class="border-b border-accent pb-1 font-display text-sm font-semibold tracking-widest text-accent uppercase"
				>
					{t.derived.title}
				</h3>
				<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
					<StatTile label={t.derived.kd} value={formatDecimal(kdRatio(session.stats))} />
					<StatTile label={t.derived.success} value={formatPercent(successRate(session.stats))} />
					<StatTile label={t.derived.accuracy} value={formatPercent(accuracy(session.stats))} />
				</div>
			</section>
		{/if}

		{#if session.issues.length > 0}
			<section aria-label={t.issuesTitle}>
				<h3
					class="border-b border-accent pb-1 font-display text-sm font-semibold tracking-widest text-accent uppercase"
				>
					{t.issuesTitle}
				</h3>
				<ul class="mt-3 space-y-2">
					{#each session.issues as issue, i (i)}
						<li
							class="border-l-2 py-1 pl-3 text-sm {issue.severity === 'error'
								? 'border-danger text-danger'
								: 'border-accent text-text'}"
						>
							{ru.importer.issues[issue.code](issue.params)}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<div class="flex flex-wrap items-center gap-3 border-t border-line pt-4">
			<Button disabled={!session.canSave} onclick={save}>
				{session.saveState === 'saving' ? t.saving : t.save}
			</Button>
			<Button variant="secondary" onclick={() => session.reset()}>{t.restart}</Button>
		</div>

		<p
			role="status"
			class="text-sm {session.saveState === 'failed' ? 'text-danger' : 'text-text-muted'}"
		>
			{#if session.saveState === 'failed'}
				{t.saveFailed}
			{:else if session.isDuplicate}
				{t.duplicate}
			{:else if !session.canSave && (session.blocking.length > 0 || session.issues.some((i) => i.severity === 'error'))}
				{t.blocked}
			{/if}
		</p>
	</div>
</Panel>
