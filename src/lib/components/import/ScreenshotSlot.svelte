<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { ACCEPTED_TYPES } from '#lib/import/image.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import type { Slot } from '#lib/stores/importSession.svelte.ts';

	interface Props {
		index: number;
		slot: Slot;
		scanning: boolean;
		locked: boolean;
		onfiles: (files: File[], index: number) => void;
		onclear: (index: number) => void;
	}

	let { index, slot, scanning, locked, onfiles, onclear }: Props = $props();

	const t = ru.importer.slot;
	let dragging = $state(false);
	let input = $state<HTMLInputElement>();

	function handleDrop(event: DragEvent): void {
		event.preventDefault();
		dragging = false;
		if (locked) return;
		onfiles([...(event.dataTransfer?.files ?? [])], index);
	}

	function handleChange(event: Event & { currentTarget: HTMLInputElement }): void {
		onfiles([...(event.currentTarget.files ?? [])], index);
		event.currentTarget.value = '';
	}
</script>

<div
	role="group"
	aria-label={t.title(index + 1)}
	class="border bg-surface transition-colors {dragging ? 'border-accent' : 'border-line'}"
	ondragover={(event) => {
		event.preventDefault();
		if (!locked) dragging = true;
	}}
	ondragleave={() => (dragging = false)}
	ondrop={handleDrop}
>
	<header class="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
		<h3 class="font-display text-sm font-semibold tracking-widest text-text uppercase">
			{t.title(index + 1)}
		</h3>
		<Badge tone={slot.file ? 'accent' : 'neutral'}>{t.hint[index]}</Badge>
	</header>

	<div class="relative aspect-video overflow-hidden bg-bg">
		{#if slot.previewUrl}
			<img src={slot.previewUrl} alt={t.previewAlt(index + 1)} class="size-full object-contain" />
			{#if scanning}
				<div
					aria-hidden="true"
					class="pointer-events-none absolute inset-x-0 h-12 animate-scan bg-linear-to-b from-transparent via-accent/30 to-transparent"
				></div>
			{/if}
		{:else}
			<div class="flex size-full flex-col items-center justify-center gap-3 p-4 text-center">
				<p class="font-display text-sm tracking-widest text-text-muted uppercase">{t.drop}</p>
				<Button size="sm" disabled={locked} onclick={() => input?.click()}>{t.choose}</Button>
				<p class="text-xs text-text-muted">{t.paste}</p>
			</div>
		{/if}
	</div>

	{#if slot.file}
		<footer class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
			<p class="min-w-0 truncate text-xs text-text-muted" title={slot.file.name}>
				{slot.file.name}
			</p>
			<div class="flex gap-2">
				<Button variant="secondary" size="sm" disabled={locked} onclick={() => input?.click()}>
					{t.replace}
				</Button>
				<Button variant="secondary" size="sm" disabled={locked} onclick={() => onclear(index)}>
					{t.remove}
				</Button>
			</div>
		</footer>
	{/if}

	<input
		bind:this={input}
		type="file"
		accept={ACCEPTED_TYPES.join(',')}
		class="sr-only"
		tabindex="-1"
		aria-hidden="true"
		onchange={handleChange}
	/>
</div>
