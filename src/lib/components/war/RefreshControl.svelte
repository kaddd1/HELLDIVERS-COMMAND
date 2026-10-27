<script lang="ts">
	import { formatAge, formatClock, formatInt } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import { majorOrders, type RefreshResult } from '#lib/stores/war.svelte.ts';
	import type { OrderChanges } from '#lib/war/majorOrders.ts';

	interface Props {
		/** Current client time in milliseconds, updated every second. */
		tick: number;
	}

	let { tick }: Props = $props();

	const t = ru.war;
	const c = t.control;
	/** How long success and info messages stay on screen. */
	const MESSAGE_MS = 8000;

	const payload = $derived(majorOrders.payload);
	const waitMs = $derived(
		majorOrders.nextRefreshAt === null ? 0 : Math.max(0, majorOrders.nextRefreshAt - tick)
	);
	const waiting = $derived(!majorOrders.refreshing && waitMs > 0);
	const waitSeconds = $derived(Math.ceil(waitMs / 1000));
	const waitShare = $derived(
		majorOrders.waitTotalMs > 0 ? Math.min(1, waitMs / majorOrders.waitTotalMs) : 0
	);
	const age = $derived(
		payload ? formatAge(tick + majorOrders.clockOffsetMs - Date.parse(payload.fetchedAt)) : ''
	);

	const message = $derived.by(() => {
		const result = majorOrders.result;
		if (!result || !payload) return null;
		// Failures stay visible in the page's notice about outdated data.
		if (result.kind === 'error' || tick - result.at > MESSAGE_MS) return null;
		return describe(result);
	});

	function summarize(changes: OrderChanges): string {
		const parts = changes.progress.slice(0, 3).map((change) => {
			const name = change.faction
				? t.tasks.factions[change.faction]
				: t.tasks.kinds[change.kind === 'unknown' ? 'eradicate' : change.kind];
			return `${name} ${change.delta >= 0 ? '+' : '−'}${formatInt(Math.abs(change.delta))}`;
		});
		const rest = changes.progress.length - parts.length;
		return rest > 0 ? `${parts.join(', ')} ${c.more(rest)}` : parts.join(', ');
	}

	function describe(result: Exclude<RefreshResult, { kind: 'error' }>) {
		switch (result.kind) {
			case 'updated':
				return {
					tone: 'ok' as const,
					text:
						result.changes.progress.length > 0
							? c.results.updated(summarize(result.changes))
							: c.results.structure
				};
			case 'unchanged':
				return { tone: 'ok' as const, text: c.results.unchanged };
			case 'cached':
				return { tone: 'info' as const, text: c.results.cached(formatAge(result.ageMs)) };
		}
	}

	const toneClass = {
		ok: 'border-ok text-text',
		info: 'border-accent text-text'
	} as const;
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
		{#if payload}
			<p class="text-sm text-text-muted tabular-nums">
				{t.updatedAt}: <span class="text-text">{formatClock(payload.fetchedAt)}</span>
				<span class="ml-1 text-xs">· {age}</span>
			</p>
		{/if}

		<button
			type="button"
			disabled={majorOrders.refreshing || waiting}
			onclick={() => majorOrders.load(true)}
			class="relative flex items-center gap-2 overflow-hidden border border-line px-3 py-1 font-display text-xs font-semibold tracking-widest text-text uppercase transition-colors enabled:hover:border-accent enabled:hover:text-accent disabled:cursor-not-allowed disabled:text-text-muted"
		>
			<svg
				viewBox="0 0 16 16"
				class="size-3.5 {majorOrders.refreshing ? 'animate-spin' : ''}"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
				<path d="M13.5 2.5v3h-3" />
			</svg>
			<span class="min-w-[6.5rem] text-left tabular-nums">
				{majorOrders.refreshing ? c.busy : waiting ? c.wait(waitSeconds) : c.button}
			</span>
			{#if majorOrders.refreshing}
				<span class="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden" aria-hidden="true">
					<span class="block h-full w-2/5 animate-slide bg-accent"></span>
				</span>
			{:else if waiting}
				<span
					class="absolute bottom-0 left-0 h-0.5 bg-accent/70 transition-[width] duration-1000 ease-linear"
					style:width="{waitShare * 100}%"
					aria-hidden="true"
				></span>
			{/if}
		</button>
	</div>

	<div aria-live="polite" class="min-h-0">
		{#if message}
			<p class="border-l-2 py-0.5 pl-3 text-sm {toneClass[message.tone]}">{message.text}</p>
		{/if}
	</div>
</div>
