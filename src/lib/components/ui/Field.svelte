<script lang="ts">
	interface Props {
		label: string;
		value: string;
		error?: string;
		hint?: string;
		numeric?: boolean;
		maxlength?: number;
	}

	let { label, value = $bindable(), error, hint, numeric = false, maxlength }: Props = $props();

	const id = $props.id();
	const describedBy = $derived(
		[hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
			undefined
	);
</script>

<div>
	<label for={id} class="block font-display text-xs tracking-widest text-text-muted uppercase">
		{label}
	</label>
	<input
		{id}
		bind:value
		{maxlength}
		type="text"
		inputmode={numeric ? 'numeric' : undefined}
		autocomplete="off"
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		class="mt-1 block w-full border bg-bg px-3 py-2 text-text transition-colors placeholder:text-text-muted/60 hover:border-text-muted
			{error ? 'border-danger' : 'border-line'}"
	/>
	{#if hint}
		<p id="{id}-hint" class="mt-1 text-xs text-text-muted">{hint}</p>
	{/if}
	{#if error}
		<p id="{id}-error" class="mt-1 text-xs text-danger">{error}</p>
	{/if}
</div>
