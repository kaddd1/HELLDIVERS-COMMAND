<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { ru } from '#lib/i18n/ru.ts';

	const t = ru.error;
	const copy = $derived(page.status === 404 ? t.notFound : t.other);
</script>

<svelte:head>
	<title>{copy.title} — {ru.app.name}</title>
</svelte:head>

<EmptyState title={copy.title} text={copy.text}>
	<a
		href={resolve('/')}
		class="inline-block font-display text-xs tracking-widest text-accent uppercase underline underline-offset-4"
	>
		{t.home}
	</a>
</EmptyState>
