import {
	deleteSnapshot,
	loadProfile,
	loadSnapshots,
	saveProfileAndSnapshots
} from '../db/storage.ts';
import { activeSnapshots, sortSnapshots } from '../analytics/history.ts';
import { planImport, type ImportPlan, type ParsedBackup } from '../domain/backup.ts';
import { findDuplicate } from '../domain/duplicates.ts';
import type {
	CapturedAtSource,
	PlayerProfile,
	PlayerStats,
	StatsSnapshot
} from '../domain/stats.ts';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export interface NewSnapshot {
	displayName: string;
	stats: PlayerStats;
	capturedAt: string;
	capturedAtSource: CapturedAtSource;
	resetConfirmed: boolean;
}

class CareerStore {
	status = $state<Status>('idle');
	profile = $state<PlayerProfile | null>(null);
	snapshots = $state<StatsSnapshot[]>([]);

	active = $derived(activeSnapshots(this.snapshots));
	latest = $derived(this.active.at(-1) ?? null);
	previous = $derived(this.active.at(-2) ?? null);

	async load(): Promise<void> {
		if (this.status === 'loading' || this.status === 'ready') return;
		this.status = 'loading';
		try {
			const [profile, snapshots] = await Promise.all([loadProfile(), loadSnapshots()]);
			this.profile = profile;
			this.snapshots = sortSnapshots(snapshots);
			this.status = 'ready';
		} catch {
			this.status = 'error';
		}
	}

	findDuplicate(stats: PlayerStats, capturedAt: string): StatsSnapshot | null {
		return findDuplicate(this.snapshots, stats, capturedAt);
	}

	/**
	 * Stores confirmed screenshot data as a new snapshot. Identical neighbouring stats are not
	 * saved twice. Throws on storage failure.
	 */
	async saveImport(input: NewSnapshot): Promise<'saved' | 'duplicate'> {
		if (this.findDuplicate(input.stats, input.capturedAt)) return 'duplicate';

		const now = new Date().toISOString();
		const profile: PlayerProfile = {
			id: 'me',
			displayName: input.displayName,
			createdAt: this.profile?.createdAt ?? now
		};
		const snapshot: StatsSnapshot = {
			id: crypto.randomUUID(),
			capturedAt: input.capturedAt,
			importedAt: now,
			capturedAtSource: input.capturedAtSource,
			source: 'screenshot',
			stats: input.stats
		};
		if (input.resetConfirmed) snapshot.resetConfirmed = true;

		await saveProfileAndSnapshots(profile, [snapshot]);
		this.profile = profile;
		this.snapshots = sortSnapshots([...this.snapshots, snapshot]);
		return 'saved';
	}

	async update(id: string, patch: Partial<Pick<StatsSnapshot, 'resetConfirmed' | 'excluded'>>) {
		const current = this.snapshots.find((s) => s.id === id);
		if (!current) return;
		// IndexedDB cannot store Svelte's reactive proxies, so work on a plain copy.
		const next: StatsSnapshot = { ...$state.snapshot(current), ...patch };
		if (!next.resetConfirmed) delete next.resetConfirmed;
		if (!next.excluded) delete next.excluded;

		await saveProfileAndSnapshots(null, [next]);
		this.snapshots = this.snapshots.map((s) => (s.id === id ? next : s));
	}

	async remove(id: string): Promise<void> {
		await deleteSnapshot(id);
		this.snapshots = this.snapshots.filter((s) => s.id !== id);
	}

	planBackup(backup: Extract<ParsedBackup, { ok: true }>): ImportPlan {
		return planImport(this.snapshots, backup.snapshots);
	}

	async importBackup(backup: Extract<ParsedBackup, { ok: true }>): Promise<number> {
		const plan = this.planBackup(backup);
		if (plan.toAdd.length === 0) return 0;

		const now = new Date().toISOString();
		const profile: PlayerProfile | null = this.profile
			? null
			: {
					id: 'me',
					displayName: backup.profile?.displayName ?? '',
					createdAt: backup.profile?.createdAt ?? now
				};
		const usableProfile = profile && profile.displayName !== '' ? profile : null;

		await saveProfileAndSnapshots(usableProfile, plan.toAdd);
		if (usableProfile) this.profile = usableProfile;
		this.snapshots = sortSnapshots([...this.snapshots, ...plan.toAdd]);
		return plan.toAdd.length;
	}
}

export const career = new CareerStore();
