<script lang="ts">
	import { ru } from '#lib/i18n/ru.ts';

	interface Props {
		progress: number;
		/** Screenshot being scanned (0-based), or -1 while the engine starts. */
		scanning: number;
	}

	let { progress, scanning }: Props = $props();

	const t = ru.importer.scan;
	const percent = $derived(Math.round(progress * 100));
</script>

<div class="border border-l-4 border-line border-l-accent bg-surface p-4" aria-live="polite">
	<div class="flex items-baseline justify-between gap-4">
		<p class="font-display text-sm tracking-widest text-accent uppercase">{t.title}</p>
		<p class="font-mono text-sm text-text tabular-nums">{percent}%</p>
	</div>
	<div
		role="progressbar"
		aria-label={t.title}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={percent}
		class="mt-3 h-2 bg-surface-raised"
	>
		<div
			class="h-full bg-accent transition-[width] duration-300 ease-out"
			style:width="{percent}%"
		></div>
	</div>
	<p class="mt-3 font-mono text-xs text-text-muted">
		{scanning < 0 ? t.engine : t.screenshot(scanning + 1)}
	</p>
</div>
