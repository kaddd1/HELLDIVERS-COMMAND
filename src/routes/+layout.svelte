<script lang="ts">
	import './layout.css';
	import AppHeader from '#lib/components/layout/AppHeader.svelte';
	import { ru } from '#lib/i18n/ru.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>{ru.app.name}</title>
	<meta name="description" content={ru.app.description} />
</svelte:head>

<a
	href="#content"
	class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink"
>
	{ru.common.skipToContent}
</a>

<AppHeader />

<main id="content" class="mx-auto max-w-6xl px-4 py-8">
	{@render children()}
</main>
