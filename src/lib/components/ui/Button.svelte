<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary';
		size?: 'md' | 'sm';
		type?: 'button' | 'submit';
		disabled?: boolean;
		onclick?: () => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		onclick,
		children
	}: Props = $props();
</script>

<button
	{type}
	{disabled}
	{onclick}
	class="border font-display font-semibold tracking-widest uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50
		{size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm'}
		{variant === 'primary'
		? 'border-accent bg-accent text-accent-ink hover:bg-accent-strong'
		: 'border-line bg-transparent text-text hover:border-accent hover:text-accent'}"
>
	{@render children()}
</button>
