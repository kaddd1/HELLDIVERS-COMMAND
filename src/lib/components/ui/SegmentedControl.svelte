<script lang="ts" generics="T extends string">
	import { onMount } from 'svelte';

	interface Props {
		label: string;
		options: readonly { value: T; label: string }[];
		value: T;
	}

	let { label, options, value = $bindable() }: Props = $props();

	const name = $props.id();

	let track = $state<HTMLDivElement>();
	let box = $state<{ x: number; y: number; w: number; h: number } | null>(null);
	/** Movement is enabled after the first measurement so the highlight does not fly in from the corner. */
	let animated = $state(false);

	function measure(): void {
		const active = track?.querySelector<HTMLElement>('label[data-active="true"]');
		box = active
			? { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight }
			: null;
	}

	$effect(() => {
		void value;
		void options;
		measure();
	});

	onMount(() => {
		measure();
		const observer = new ResizeObserver(measure);
		if (track) observer.observe(track);
		const frame = requestAnimationFrame(() => (animated = true));
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
		};
	});
</script>

<fieldset class="min-w-0">
	<legend class="mb-1 font-display text-xs tracking-widest text-text-muted uppercase">
		{label}
	</legend>
	<div bind:this={track} class="relative flex flex-wrap border border-line">
		{#if box}
			<span
				aria-hidden="true"
				class="pointer-events-none absolute top-0 left-0 bg-accent {animated
					? 'transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]'
					: ''}"
				style:width="{box.w}px"
				style:height="{box.h}px"
				style:transform="translate({box.x}px, {box.y}px)"
			></span>
		{/if}
		{#each options as option (option.value)}
			<label
				data-active={value === option.value}
				class="relative z-10 cursor-pointer border-r border-line px-3 py-1.5 font-display text-xs font-semibold tracking-widest uppercase transition-colors last:border-r-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent
					{value === option.value
					? `text-accent-ink ${box ? '' : 'bg-accent'}`
					: 'text-text-muted hover:text-text'}"
			>
				<input type="radio" {name} value={option.value} bind:group={value} class="sr-only" />
				{option.label}
			</label>
		{/each}
	</div>
</fieldset>
