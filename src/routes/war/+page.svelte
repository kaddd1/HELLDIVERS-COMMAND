<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeading from '#lib/components/layout/PageHeading.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import MajorOrderCard from '#lib/components/war/MajorOrderCard.svelte';
	import { formatClock } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import { majorOrders } from '#lib/stores/war.svelte.ts';

	const t = ru.war;

	let tick = $state(Date.now());
	const now = $derived(tick + majorOrders.clockOffsetMs);

	onMount(() => {
		void majorOrders.load();
		const timer = setInterval(() => (tick = Date.now()), 1000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head>
	<title>{ru.pages.war.title} — {ru.app.name}</title>
</svelte:head>

<PageHeading title={ru.pages.war.title} description={ru.pages.war.description} />

{#if majorOrders.status === 'error' && majorOrders.error}
	<div class="space-y-4">
		<p role="alert" class="border border-danger p-4 text-danger">
			{t.errors[majorOrders.error]}
		</p>
		<Button disabled={majorOrders.refreshing} onclick={() => majorOrders.load(true)}>
			{majorOrders.refreshing ? t.refreshing : t.retry}
		</Button>
	</div>
{:else if majorOrders.status !== 'ready' || !majorOrders.payload}
	<p class="text-text-muted" aria-live="polite">{t.loading}</p>
{:else}
	{@const payload = majorOrders.payload}
	<div class="space-y-6">
		<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
			<p class="text-sm text-text-muted tabular-nums">
				{t.updatedAt}: <span class="text-text">{formatClock(payload.fetchedAt)}</span>
			</p>
			<Button
				variant="secondary"
				size="sm"
				disabled={majorOrders.refreshing}
				onclick={() => majorOrders.load(true)}
			>
				{majorOrders.refreshing ? t.refreshing : t.refresh}
			</Button>
		</div>

		{#if payload.stale}
			<p role="status" class="border-l-2 border-danger pl-3 text-sm text-danger">
				{t.staleNotice(formatClock(payload.fetchedAt))}
			</p>
		{:else if majorOrders.error}
			<p role="alert" class="border-l-2 border-danger pl-3 text-sm text-danger">
				{t.errors[majorOrders.error]}
			</p>
		{/if}

		{#if payload.orders.length === 0}
			<EmptyState title={t.empty.title} text={t.empty.text} />
		{:else}
			{#each payload.orders as order (order.id)}
				<div class="animate-reveal">
					<MajorOrderCard {order} {now} language={payload.language} />
				</div>
			{/each}
		{/if}

		<p class="text-xs text-text-muted">{t.source}</p>
	</div>
{/if}
