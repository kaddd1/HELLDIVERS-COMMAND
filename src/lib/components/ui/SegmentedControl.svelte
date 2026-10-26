<script lang="ts" generics="T extends string">
	interface Props {
		label: string;
		options: readonly { value: T; label: string }[];
		value: T;
	}

	let { label, options, value = $bindable() }: Props = $props();

	const name = $props.id();
</script>

<fieldset class="min-w-0">
	<legend class="mb-1 font-display text-xs tracking-widest text-text-muted uppercase">
		{label}
	</legend>
	<div class="flex flex-wrap border border-line">
		{#each options as option (option.value)}
			<label
				class="cursor-pointer border-r border-line px-3 py-1.5 font-display text-xs font-semibold tracking-widest uppercase transition-colors last:border-r-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent
					{value === option.value
					? 'bg-accent text-accent-ink'
					: 'bg-transparent text-text-muted hover:text-text'}"
			>
				<input type="radio" {name} value={option.value} bind:group={value} class="sr-only" />
				{option.label}
			</label>
		{/each}
	</div>
</fieldset>
