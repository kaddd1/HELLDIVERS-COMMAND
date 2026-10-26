<script lang="ts">
	interface Props {
		label: string;
		value: string;
		hint?: string;
	}

	let { label, value, hint }: Props = $props();
</script>

<div class="border-l-2 border-accent bg-surface-raised px-4 py-3">
	<p class="font-display text-xs tracking-widest text-text-muted uppercase">{label}</p>
	<p class="mt-1 font-display text-3xl font-bold text-text tabular-nums">{value}</p>
	{#if hint}
		<p class="mt-1 text-xs text-text-muted">{hint}</p>
	{/if}
</div>
