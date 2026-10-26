<script lang="ts">
	interface Props {
		title: string;
		description: string;
	}

	let { title, description }: Props = $props();
</script>

<div class="mb-6">
	<h1 class="font-display text-2xl font-bold tracking-wide text-text uppercase md:text-3xl">
		{title}
	</h1>
	<p class="mt-1 text-text-muted">{description}</p>
</div>
