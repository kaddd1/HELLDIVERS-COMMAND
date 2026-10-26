<script lang="ts">
	import { onDestroy } from 'svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import { ru } from '#lib/i18n/ru.ts';
	import { ImportSession } from '#lib/stores/importSession.svelte.ts';
	import ReviewPanel from './ReviewPanel.svelte';
	import ScanProgress from './ScanProgress.svelte';
	import ScreenshotSlot from './ScreenshotSlot.svelte';

	interface Props {
		onsaved?: () => void;
		oncancel?: () => void;
	}

	let { onsaved, oncancel }: Props = $props();

	const t = ru.importer;
	const session = new ImportSession();
	onDestroy(() => session.destroy());

	const locked = $derived(session.phase === 'scanning' || session.phase === 'review');

	function handlePaste(event: ClipboardEvent): void {
		if (locked) return;
		const files = [...(event.clipboardData?.files ?? [])];
		if (files.length === 0) return;
		event.preventDefault();
		session.addPasted(files);
	}
</script>

<svelte:window onpaste={handlePaste} />

<div class="space-y-6">
	<Panel title={t.title}>
		<div class="space-y-5">
			<p class="max-w-3xl text-text-muted">{t.intro}</p>

			<ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each t.steps as step, i (i)}
					<li class="flex gap-3 text-sm text-text-muted">
						<span
							class="flex size-6 shrink-0 items-center justify-center border border-accent font-display text-xs font-bold text-accent"
						>
							{i + 1}
						</span>
						<span>{step}</span>
					</li>
				{/each}
			</ol>

			<div class="grid gap-4 md:grid-cols-2">
				{#each session.slots as slot, index (index)}
					<ScreenshotSlot
						{index}
						{slot}
						{locked}
						scanning={session.phase === 'scanning' && session.scanning === index}
						onfiles={(files, at) => session.addFiles(files, at)}
						onclear={(at) => session.clearSlot(at)}
					/>
				{/each}
			</div>

			<p class="text-xs text-text-muted">{t.privacy}</p>

			{#if session.rejectedFile}
				<p role="alert" class="text-sm text-danger">{t.rejected}</p>
			{/if}

			{#if session.phase === 'scanning'}
				<ScanProgress progress={session.progress} scanning={session.scanning} />
			{/if}

			{#if session.phase === 'failed' && session.failure}
				<p role="alert" class="border border-danger p-3 text-sm text-danger">
					{t.failures[session.failure]}
				</p>
			{/if}

			{#if session.phase !== 'review'}
				<div class="flex flex-wrap items-center gap-3">
					<Button disabled={!session.canAnalyze} onclick={() => session.analyze()}>
						{session.phase === 'scanning' ? t.analyzing : t.analyze}
					</Button>
					{#if oncancel}
						<Button variant="secondary" disabled={session.phase === 'scanning'} onclick={oncancel}>
							{t.cancel}
						</Button>
					{/if}
				</div>
			{/if}
		</div>
	</Panel>

	{#if session.phase === 'review'}
		<div class="animate-reveal">
			<ReviewPanel {session} onsaved={() => onsaved?.()} />
		</div>
	{/if}
</div>
