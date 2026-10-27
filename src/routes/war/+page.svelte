<script lang="ts">
	import { onMount } from 'svelte';
	import PageHeading from '#lib/components/layout/PageHeading.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import RefreshControl from '#lib/components/war/RefreshControl.svelte';
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
		<RefreshControl {tick} />

		{#if payload.stale || majorOrders.error}
			<div role="status" class="border-l-2 border-danger pl-3 text-sm text-danger">
				<p>{t.staleNotice(formatClock(payload.fetchedAt))}</p>
				{#if majorOrders.error}
					<p class="mt-1 text-text-muted">{t.errors[majorOrders.error]}</p>
				{/if}
			</div>
		{/if}

		{#if payload.orders.length === 0}
			<EmptyState title={t.empty.title} text={t.empty.text} />
		{:else}
			{#each payload.orders as order (order.id)}
				<div class="animate-reveal">
					<MajorOrderCard
						{order}
						{now}
						language={payload.language}
						pulse={majorOrders.pulse}
						pulseToken={majorOrders.pulseToken}
					/>
				</div>
			{/each}
		{/if}

		<p class="text-xs text-text-muted">{t.source}</p>
	</div>
{/if}
