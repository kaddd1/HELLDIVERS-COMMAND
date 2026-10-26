<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		tone?: 'neutral' | 'accent' | 'danger';
		children: Snippet;
	}

	let { tone = 'neutral', children }: Props = $props();
</script>

<span
	class="inline-block border px-2 py-0.5 font-display text-xs font-semibold tracking-widest uppercase
		{tone === 'accent'
		? 'border-accent text-accent'
		: tone === 'danger'
			? 'border-danger text-danger'
			: 'border-line text-text-muted'}"
>
	{@render children()}
</span>
