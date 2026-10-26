<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Panel from '#lib/components/ui/Panel.svelte';
	import {
		createBackup,
		parseBackup,
		type BackupErrorCode,
		type ImportPlan,
		type InvalidReason,
		type ParsedBackup
	} from '#lib/domain/backup.ts';
	import { formatDateTime } from '#lib/format.ts';
	import { ru } from '#lib/i18n/ru.ts';
	import { career } from '#lib/stores/career.svelte.ts';

	const t = ru.data.export;
	const i = ru.data.import;

	const MAX_FILE_BYTES = 20 * 1024 * 1024;
	const SHOWN_ROWS = 8;

	type Valid = Extract<ParsedBackup, { ok: true }>;

	let input = $state<HTMLInputElement>();
	let message = $state<{ text: string; tone: 'ok' | 'error' } | null>(null);
	let parsed = $state.raw<Valid | null>(null);
	let plan = $state.raw<ImportPlan | null>(null);
	let busy = $state(false);

	function exportJson(): void {
		message = null;
		if (career.snapshots.length === 0) {
			message = { text: t.nothing, tone: 'error' };
			return;
		}
		const backup = createBackup(career.profile, career.snapshots);
		const blob = new Blob([JSON.stringify(backup, null, '\t')], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `helldivers-command-${new Date().toISOString().slice(0, 10)}.json`;
		document.body.append(link);
		link.click();
		link.remove();
		URL.revokeObjectURL(url);
		message = { text: t.done(career.snapshots.length), tone: 'ok' };
	}

	function reasonText(reason: InvalidReason): string {
		const r = i.reasons;
		switch (reason.code) {
			case 'badValue':
				return r.badValue(reason.field);
			case 'inconsistent':
				return r.inconsistent;
			default:
				return r[reason.code];
		}
	}

	async function chooseFile(event: Event & { currentTarget: HTMLInputElement }): Promise<void> {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		parsed = null;
		plan = null;
		message = null;
		if (!file) return;
		if (file.size > MAX_FILE_BYTES) {
			message = { text: i.errors.tooLarge, tone: 'error' };
			return;
		}

		busy = true;
		try {
			const result = parseBackup(await file.text());
			if (!result.ok) {
				message = { text: i.errors[result.error satisfies BackupErrorCode], tone: 'error' };
				return;
			}
			parsed = result;
			plan = career.planBackup(result);
		} catch {
			message = { text: i.errors.readFailed, tone: 'error' };
		} finally {
			busy = false;
		}
	}

	async function confirmImport(): Promise<void> {
		if (!parsed) return;
		busy = true;
		try {
			const added = await career.importBackup(parsed);
			message = { text: `${i.added(added)} ${i.existingKept}`, tone: 'ok' };
			parsed = null;
			plan = null;
		} catch {
			message = { text: i.failed, tone: 'error' };
		} finally {
			busy = false;
		}
	}

	function cancel(): void {
		parsed = null;
		plan = null;
	}
</script>

<Panel title={t.title}>
	<div class="space-y-5">
		<p class="max-w-3xl text-sm text-text-muted">{t.text}</p>

		<div class="flex flex-wrap items-center gap-3">
			<Button onclick={exportJson}>{t.button}</Button>
			<Button variant="secondary" disabled={busy} onclick={() => input?.click()}>
				{busy ? i.working : i.button}
			</Button>
			<input
				bind:this={input}
				type="file"
				accept="application/json,.json"
				class="sr-only"
				tabindex="-1"
				aria-hidden="true"
				onchange={chooseFile}
			/>
		</div>

		<p
			role="status"
			class="text-sm {message?.tone === 'error' ? 'text-danger' : 'text-text-muted'}"
		>
			{message?.text ?? ''}
		</p>

		{#if parsed && plan}
			<div class="space-y-4 border border-l-4 border-line border-l-accent p-4">
				<h3 class="font-display text-sm font-semibold tracking-widest text-accent uppercase">
					{i.previewTitle}
				</h3>
				<div class="flex flex-wrap gap-2">
					<Badge>{i.valid(parsed.snapshots.length)}</Badge>
					<Badge tone="accent">{i.willAdd(plan.toAdd.length)}</Badge>
					{#if plan.duplicates.length > 0}
						<Badge>{i.duplicates(plan.duplicates.length)}</Badge>
					{/if}
					{#if parsed.invalid.length > 0}
						<Badge tone="danger">{i.invalid(parsed.invalid.length)}</Badge>
					{/if}
				</div>

				{#if parsed.invalid.length > 0}
					<ul class="space-y-1 text-sm text-danger">
						{#each parsed.invalid.slice(0, SHOWN_ROWS) as entry (entry.position)}
							<li>{i.position(entry.position)}: {reasonText(entry.reason)}</li>
						{/each}
					</ul>
				{/if}

				{#if plan.duplicates.length > 0}
					<ul class="space-y-1 text-sm text-text-muted">
						{#each plan.duplicates.slice(0, SHOWN_ROWS) as duplicate (duplicate.snapshot.id)}
							<li>
								{formatDateTime(duplicate.snapshot.capturedAt)}:
								{duplicate.reason === 'id' ? i.duplicateById : i.duplicateByContent}
							</li>
						{/each}
					</ul>
				{/if}

				{#if plan.toAdd.length === 0}
					<p class="text-sm text-text-muted">{i.nothingToAdd}</p>
				{/if}

				<div class="flex flex-wrap gap-3">
					<Button disabled={busy || plan.toAdd.length === 0} onclick={confirmImport}>
						{i.confirm(plan.toAdd.length)}
					</Button>
					<Button variant="secondary" onclick={cancel}>{i.cancel}</Button>
				</div>
			</div>
		{/if}
	</div>
</Panel>
