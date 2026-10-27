<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { formatInt, formatPercent } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import {
		counterShare,
		orderState,
		type MajorOrder,
		type OrderTask
	} from '#lib/war/majorOrders.ts';
	import Countdown from './Countdown.svelte';

	interface Props {
		order: MajorOrder;
		/** Current time in milliseconds, already corrected for the server clock. */
		now: number;
		/** Language of the order texts as reported by the API. */
		language: string | null;
	}

	let { order, now, language }: Props = $props();

	const t = ru.war;
	const state = $derived(orderState(order, now));
	const stateTone = $derived(
		state === 'completed' ? 'accent' : state === 'expired' ? 'danger' : 'neutral'
	);
	const measured = $derived(order.tasks.filter((task) => task.counter !== null));
	const doneCount = $derived(
		measured.filter((task) => task.counter!.current >= task.counter!.goal).length
	);
	const foreignLanguage = $derived(language !== null && !language.toLowerCase().startsWith('ru'));

	function taskLabel(task: OrderTask): string {
		return task.kind === 'unknown' ? t.tasks.kinds.unknown(task.type) : t.tasks.kinds[task.kind];
	}
</script>

<article class="border border-l-4 border-line border-l-accent bg-surface">
	<header
		class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3"
	>
		<p class="font-display text-xs font-semibold tracking-widest text-accent uppercase">
			{t.eyebrow}
		</p>
		<div class="flex items-center gap-3">
			<span class="text-xs text-text-muted tabular-nums">{t.orderNumber(order.id)}</span>
			<Badge tone={stateTone}>{t.state[state]}</Badge>
		</div>
	</header>

	<div class="grid gap-8 p-5 lg:grid-cols-[1fr_auto]">
		<div class="min-w-0 space-y-4">
			{#if order.title}
				<h2 class="font-display text-3xl font-bold tracking-wide text-text uppercase md:text-4xl">
					{order.title}
				</h2>
			{/if}
			{#if order.briefing}
				<p class="border-l-2 border-line pl-4 text-lg leading-relaxed text-text">
					{order.briefing}
				</p>
			{/if}
			{#if order.description}
				<p class="text-text-muted">{order.description}</p>
			{/if}
			{#if foreignLanguage && language}
				<p class="text-xs text-text-muted">{t.languageNote(language)}</p>
			{/if}
		</div>

		<div class="lg:text-right">
			<div class="lg:flex lg:justify-end">
				<Countdown expiresAt={order.expiresAt} {now} />
			</div>
		</div>
	</div>

	<div class="grid gap-8 border-t border-line p-5 lg:grid-cols-[1fr_16rem]">
		<section>
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h3 class="font-display text-sm font-semibold tracking-widest text-text-muted uppercase">
					{t.tasks.title}
				</h3>
				{#if measured.length > 0}
					<p class="text-xs text-text-muted">{t.tasks.summary(doneCount, measured.length)}</p>
				{/if}
			</div>

			{#if order.tasks.length === 0}
				<p class="mt-3 text-sm text-text-muted">{t.tasks.noTasks}</p>
			{:else}
				<ul class="mt-3 space-y-4">
					{#each order.tasks as task, index (index)}
						<li class="border border-line bg-bg p-4">
							<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
								<p class="font-display text-base font-semibold tracking-wide text-text uppercase">
									{taskLabel(task)}
								</p>
								{#if task.faction}
									<p class="text-sm text-text-muted">
										{t.tasks.factionLabel}:
										<span class="text-text">{t.tasks.factions[task.faction]}</span>
									</p>
								{/if}
							</div>

							{#if task.counter}
								{@const share = counterShare(task.counter)}
								<div class="mt-3 flex flex-wrap items-baseline justify-between gap-2 tabular-nums">
									<p class="font-mono text-lg text-text">
										{formatInt(task.counter.current)}
										<span class="text-text-muted">/ {formatInt(task.counter.goal)}</span>
									</p>
									{#if share >= 1}
										<Badge tone="accent">{t.tasks.done}</Badge>
									{:else}
										<p class="font-display text-xl font-bold text-accent">{formatPercent(share)}</p>
									{/if}
								</div>
								<div
									role="progressbar"
									aria-label={taskLabel(task)}
									aria-valuemin="0"
									aria-valuemax="100"
									aria-valuenow={Math.round(share * 100)}
									class="mt-2 h-2 bg-surface-raised"
								>
									<div class="h-full bg-accent" style:width="{share * 100}%"></div>
								</div>
							{:else}
								<p class="mt-2 text-xs text-text-muted">{t.tasks.noProgress}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section>
			<h3 class="font-display text-sm font-semibold tracking-widest text-text-muted uppercase">
				{t.rewards.title}
			</h3>
			{#if order.rewards.length === 0}
				<p class="mt-3 text-sm text-text-muted">{t.rewards.none}</p>
			{:else}
				<ul class="mt-3 space-y-3">
					{#each order.rewards as reward, index (index)}
						<li class="flex items-center gap-4 border border-accent/60 bg-bg p-4">
							<span
								class="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-accent font-display text-lg font-bold text-accent tabular-nums"
							>
								{formatInt(reward.amount)}
							</span>
							<span class="font-display text-sm tracking-widest text-text uppercase">
								{reward.type === 1 ? t.rewards.medals : t.rewards.unknown(reward.type)}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</article>
