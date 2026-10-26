<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		title: string;
		onclose: () => void;
		wide?: boolean;
		children: Snippet;
	}

	let { open, title, onclose, wide = false, children }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	const titleId = $props.id();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	{onclose}
	onclick={(event) => {
		// A click on the backdrop reaches the dialog element itself.
		if (event.target === dialog) onclose();
	}}
	class="m-auto max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto border border-line bg-surface p-0 text-text backdrop:bg-black/70 {wide
		? 'max-w-3xl'
		: 'max-w-md'}"
>
	{#if open}
		<div class="p-5">
			<h2 id={titleId} class="font-display text-lg font-bold tracking-widest text-accent uppercase">
				{title}
			</h2>
			<div class="mt-4">
				{@render children()}
			</div>
		</div>
	{/if}
</dialog>
