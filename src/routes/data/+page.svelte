<script lang="ts">
	import { onMount } from 'svelte';
	import { compareInHistory, sortSnapshots } from '#lib/analytics/history.ts';
	import PageHeading from '#lib/components/layout/PageHeading.svelte';
	import BackupPanel from '#lib/components/snapshots/BackupPanel.svelte';
	import SnapshotComparison from '#lib/components/snapshots/SnapshotComparison.svelte';
	import SnapshotDetails from '#lib/components/snapshots/SnapshotDetails.svelte';
	import SnapshotList from '#lib/components/snapshots/SnapshotList.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Dialog from '#lib/components/ui/Dialog.svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import type { StatsSnapshot } from '#lib/domain/stats.ts';
	import { formatDateTime } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import { career } from '#lib/stores/career.svelte.ts';

	const t = ru.data;

	let selected = $state<string[]>([]);
	let inspected = $state<StatsSnapshot | null>(null);
	let pendingDelete = $state<StatsSnapshot | null>(null);
	let deleteFailed = $state(false);
	let updateFailed = $state(false);

	const newestFirst = $derived(sortSnapshots(career.snapshots).reverse());
	const chosen = $derived(
		selected
			.map((id) => career.snapshots.find((s) => s.id === id))
			.filter((s): s is StatsSnapshot => s !== undefined)
	);
	const comparison = $derived(
		chosen.length === 2 ? compareInHistory(career.active, chosen[0], chosen[1]) : null
	);

	function select(id: string, checked: boolean): void {
		selected = checked ? [...selected, id].slice(-2) : selected.filter((s) => s !== id);
	}

	async function update(id: string, patch: { resetConfirmed?: boolean; excluded?: boolean }) {
		updateFailed = false;
		try {
			await career.update(id, patch);
		} catch {
			updateFailed = true;
		}
	}

	async function confirmDelete(): Promise<void> {
		if (!pendingDelete) return;
		deleteFailed = false;
		const { id } = pendingDelete;
		try {
			await career.remove(id);
			selected = selected.filter((s) => s !== id);
			pendingDelete = null;
		} catch {
			deleteFailed = true;
		}
	}

	onMount(() => {
		void career.load();
	});
</script>

<svelte:head>
	<title>{ru.pages.data.title} — {ru.app.name}</title>
</svelte:head>

<PageHeading title={ru.pages.data.title} description={ru.pages.data.description} />

{#if career.status === 'error'}
	<p role="alert" class="border border-danger p-4 text-danger">{ru.career.storageError}</p>
{:else if career.status !== 'ready'}
	<p class="text-text-muted" aria-live="polite">{ru.common.loading}</p>
{:else}
	<div class="space-y-6">
		<BackupPanel />

		<Panel title="{t.list.title} · {t.list.count(career.snapshots.length)}">
			<SnapshotList
				snapshots={newestFirst}
				active={career.active}
				{selected}
				onselect={select}
				oninspect={(snapshot) => (inspected = snapshot)}
				ondelete={(snapshot) => {
					deleteFailed = false;
					pendingDelete = snapshot;
				}}
				onupdate={update}
			/>
			{#if updateFailed}
				<p role="alert" class="mt-3 text-sm text-danger">{ru.importer.review.saveFailed}</p>
			{/if}
		</Panel>

		{#if career.snapshots.length >= 2}
			<Panel title={t.compareSection.title}>
				{#if comparison}
					<div class="mb-4">
						<Button variant="secondary" size="sm" onclick={() => (selected = [])}>
							{t.compareSection.clear}
						</Button>
					</div>
					<SnapshotComparison interval={comparison} />
				{:else}
					<p class="text-sm text-text-muted">
						{chosen.length === 1 ? t.compareSection.one : t.compareSection.pick}
					</p>
				{/if}
			</Panel>
		{/if}
	</div>
{/if}

<Dialog open={inspected !== null} title={t.inspect.title} wide onclose={() => (inspected = null)}>
	{#if inspected}
		<SnapshotDetails snapshot={inspected} playerName={career.profile?.displayName ?? null} />
		<div class="mt-5 flex justify-end">
			<Button variant="secondary" onclick={() => (inspected = null)}>{t.inspect.close}</Button>
		</div>
	{/if}
</Dialog>

<Dialog
	open={pendingDelete !== null}
	title={t.deleteDialog.title}
	onclose={() => (pendingDelete = null)}
>
	{#if pendingDelete}
		<p class="text-sm text-text-muted">
			{t.deleteDialog.text(formatDateTime(pendingDelete.capturedAt))}
		</p>
		{#if deleteFailed}
			<p role="alert" class="mt-3 text-sm text-danger">{t.deleteDialog.failed}</p>
		{/if}
		<div class="mt-5 flex flex-wrap justify-end gap-3">
			<Button variant="secondary" onclick={() => (pendingDelete = null)}>
				{t.deleteDialog.cancel}
			</Button>
			<Button onclick={confirmDelete}>{t.deleteDialog.confirm}</Button>
		</div>
	{/if}
</Dialog>
