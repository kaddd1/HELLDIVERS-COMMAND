<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		children: Snippet;
		actions?: Snippet;
	}

	let { title, children, actions }: Props = $props();
</script>

<section class="border border-line bg-surface">
	{#if title || actions}
		<header class="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
			{#if title}
				<h2 class="font-display text-sm font-semibold tracking-widest text-text-muted uppercase">
					{title}
				</h2>
			{/if}
			{@render actions?.()}
		</header>
	{/if}
	<div class="p-4">
		{@render children()}
	</div>
</section>
