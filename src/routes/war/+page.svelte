<script lang="ts">
	import PageHeading from '#lib/components/layout/PageHeading.svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import { ru } from '#lib/i18n/ru.ts';
</script>

<svelte:head>
	<title>{ru.pages.war.title} — {ru.app.name}</title>
</svelte:head>

<PageHeading title={ru.pages.war.title} description={ru.pages.war.description} />

<Panel>
	<p class="text-text-muted">{ru.common.inDevelopment}</p>
</Panel>
