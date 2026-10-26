<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		text: string;
		children?: Snippet;
	}

	let { title, text, children }: Props = $props();
</script>

<div class="border border-dashed border-line bg-surface px-6 py-10 text-center">
	<h2 class="font-display text-xl font-bold tracking-widest text-accent uppercase">{title}</h2>
	<p class="mx-auto mt-3 max-w-xl text-text-muted">{text}</p>
	{#if children}
		<div class="mt-6">{@render children()}</div>
	{/if}
</div>
