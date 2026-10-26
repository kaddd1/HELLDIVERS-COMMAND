<script lang="ts">
	import { resolve } from '$app/paths';

	interface Props {
		title: string;
		text: string;
		linkLabel: string;
	}

	let { title, text, linkLabel }: Props = $props();
</script>

<div role="status" class="border border-l-4 border-danger/60 border-l-danger bg-surface p-4">
	<p class="font-display text-sm font-semibold tracking-widest text-danger uppercase">{title}</p>
	<p class="mt-1 text-sm text-text-muted">{text}</p>
	<a
		href={resolve('/data')}
		class="mt-2 inline-block font-display text-xs tracking-widest text-accent uppercase underline underline-offset-4 hover:text-accent-strong"
	>
		{linkLabel}
	</a>
</div>
