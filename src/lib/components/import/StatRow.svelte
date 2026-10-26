<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { getDefinition } from '#lib/domain/statDefinitions.ts';
	import { formatDuration, formatStatValue } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import type { ResolvedStat } from '#lib/import/resolve.ts';

	interface Props {
		stat: ResolvedStat;
		flag: 'error' | 'warning' | null;
		onchoose: (value: number) => void;
		onconfirm: () => void;
		onedit: (text: string) => boolean;
		onundo: () => void;
	}

	let { stat, flag, onchoose, onconfirm, onedit, onundo }: Props = $props();

	const t = ru.importer.review;
	const definition = $derived(getDefinition(stat.key));
	const required = $derived(definition.required);

	let editing = $state(false);
	let draft = $state('');
	let invalid = $state(false);

	function startEdit(): void {
		if (stat.value === null) draft = '';
		else draft = definition.kind === 'duration' ? formatDuration(stat.value) : String(stat.value);
		invalid = false;
		editing = true;
	}

	function applyEdit(): void {
		if (onedit(draft)) editing = false;
		else invalid = true;
	}

	const tone = $derived(
		stat.state === 'conflict' || (stat.state === 'missing' && required)
			? 'danger'
			: stat.state === 'uncertain'
				? 'accent'
				: 'neutral'
	);
	const edge = $derived(
		tone === 'danger'
			? 'border-l-danger'
			: tone === 'accent' || flag
				? 'border-l-accent'
				: 'border-l-transparent'
	);
</script>

<li class="border-b border-l-2 border-line py-3 pl-3 {edge}">
	<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
		<div class="min-w-0">
			<p class="text-sm text-text-muted">{definition.label}</p>
			{#if stat.value !== null && stat.state !== 'conflict'}
				<p class="font-display text-xl font-semibold text-text tabular-nums">
					{formatStatValue(stat.key, stat.value)}
				</p>
			{:else if stat.state === 'missing' && !required}
				<p class="text-sm text-text-muted">{t.unrecognizedOptional}</p>
			{/if}
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<Badge {tone}>{t.state[stat.state]}</Badge>

			{#if !editing}
				{#if stat.state === 'uncertain'}
					<Button size="sm" onclick={onconfirm}>{t.actions.confirm}</Button>
				{/if}
				{#if stat.state === 'chosen' || stat.state === 'edited' || stat.state === 'confirmed'}
					<Button variant="secondary" size="sm" onclick={onundo}>{t.actions.undo}</Button>
				{/if}
				{#if stat.state === 'missing'}
					<Button variant="secondary" size="sm" onclick={startEdit}>{t.actions.enter}</Button>
				{:else if stat.state !== 'conflict'}
					<Button variant="secondary" size="sm" onclick={startEdit}>{t.actions.edit}</Button>
				{/if}
			{/if}
		</div>
	</div>

	{#if stat.state === 'conflict' && !editing}
		<div class="mt-3 flex flex-wrap items-center gap-2">
			<span class="text-xs text-text-muted">{t.actions.chooseOne}</span>
			{#each stat.candidates as candidate (candidate.value)}
				<Button variant="secondary" size="sm" onclick={() => onchoose(candidate.value)}>
					{formatStatValue(stat.key, candidate.value)}
				</Button>
			{/each}
			<Button variant="secondary" size="sm" onclick={startEdit}>{t.actions.enter}</Button>
		</div>
	{/if}

	{#if editing}
		<form
			class="mt-3 flex flex-wrap items-start gap-2"
			onsubmit={(event) => {
				event.preventDefault();
				applyEdit();
			}}
		>
			<div>
				<input
					bind:value={draft}
					type="text"
					inputmode={definition.kind === 'duration' ? 'text' : 'numeric'}
					autocomplete="off"
					aria-label={t.actions.editLabel(definition.label)}
					aria-invalid={invalid ? 'true' : undefined}
					class="w-44 border bg-bg px-3 py-1 font-mono text-text {invalid
						? 'border-danger'
						: 'border-line'}"
				/>
				{#if invalid}
					<p role="alert" class="mt-1 text-xs text-danger">
						{definition.kind === 'duration' ? t.actions.invalidDuration : t.actions.invalid}
					</p>
				{/if}
			</div>
			<Button type="submit" size="sm">{t.actions.apply}</Button>
			<Button variant="secondary" size="sm" onclick={() => (editing = false)}>
				{t.actions.cancel}
			</Button>
		</form>
	{/if}
</li>
