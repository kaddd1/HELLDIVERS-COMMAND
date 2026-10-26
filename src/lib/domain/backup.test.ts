import { describe, expect, it } from 'vitest';
import { BACKUP_APP, BACKUP_VERSION, createBackup, parseBackup, planImport } from './backup.ts';
import { findDuplicate } from './duplicates.ts';
import { makeSnapshot, makeStats } from './testing.ts';

function roundTrip(snapshots = [makeSnapshot(0, { extra: { totalXp: 100 } })]) {
	const text = JSON.stringify(
		createBackup(
			{ id: 'me', displayName: 'Tester', createdAt: '2026-01-01T00:00:00.000Z' },
			snapshots
		)
	);
	return { text, snapshots };
}

function withSnapshots(snapshots: unknown[]): string {
	return JSON.stringify({
		app: BACKUP_APP,
		schemaVersion: BACKUP_VERSION,
		exportedAt: '2026-02-01T00:00:00.000Z',
		profile: null,
		snapshots
	});
}

describe('parseBackup', () => {
	it('restores exactly what was exported', () => {
		const { text, snapshots } = roundTrip([
			makeSnapshot(0, { extra: { totalXp: 100 } }, { resetConfirmed: true }),
			makeSnapshot(3, { shotsFired: null, shotsHit: null, timePlayedSeconds: null })
		]);
		const result = parseBackup(text);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.snapshots).toEqual(snapshots);
			expect(result.invalid).toEqual([]);
			expect(result.profile?.displayName).toBe('Tester');
		}
	});

	it('rejects text that is not JSON', () => {
		expect(parseBackup('not json {')).toEqual({ ok: false, error: 'notJson' });
	});

	it('rejects JSON that is not a backup of this app', () => {
		expect(parseBackup('{"snapshots":[]}')).toEqual({ ok: false, error: 'notBackup' });
		expect(parseBackup('[]')).toEqual({ ok: false, error: 'notBackup' });
		expect(parseBackup('null')).toEqual({ ok: false, error: 'notBackup' });
	});

	it('rejects a backup from a newer version', () => {
		const text = JSON.stringify({ app: BACKUP_APP, schemaVersion: 99, snapshots: [] });
		expect(parseBackup(text)).toEqual({ ok: false, error: 'newerVersion' });
	});

	it('rejects a backup with no snapshots', () => {
		expect(parseBackup(withSnapshots([]))).toEqual({ ok: false, error: 'noSnapshots' });
	});

	it('reports invalid snapshots without importing them', () => {
		const good = makeSnapshot(0);
		const result = parseBackup(
			withSnapshots([
				good,
				'text',
				{ ...good, id: '' },
				{ ...good, id: 'x', capturedAt: 'yesterday' },
				{ ...good, id: 'y', stats: { ...good.stats, kills: -5 } },
				{ ...good, id: 'z', stats: { ...good.stats, deaths: 1.5 } },
				{ ...good, id: 'w', stats: undefined }
			])
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.snapshots).toHaveLength(1);
			expect(result.invalid.map((e) => e.reason.code)).toEqual([
				'notObject',
				'badId',
				'badDate',
				'badValue',
				'badValue',
				'badStats'
			]);
			expect(result.invalid[3].position).toBe(5);
		}
	});

	it('rejects snapshots whose values contradict each other', () => {
		const good = makeSnapshot(0);
		const bad = {
			...good,
			id: 'bad',
			stats: { ...good.stats, missionsPlayed: 10, missionsCompleted: 20 }
		};
		const result = parseBackup(withSnapshots([bad]));
		expect(result.ok && result.invalid[0].reason).toEqual({
			code: 'inconsistent',
			issue: 'completedExceedsPlayed'
		});
	});

	it('keeps older backups without newer fields compatible', () => {
		const old = {
			id: 'old',
			capturedAt: '2026-01-01T10:00:00.000Z',
			source: 'manual',
			stats: { level: 5, kills: 1, deaths: 1, missionsPlayed: 1, missionsCompleted: 1 }
		};
		const result = parseBackup(withSnapshots([old]));
		expect(result.ok).toBe(true);
		if (result.ok) {
			const [snapshot] = result.snapshots;
			expect(snapshot.importedAt).toBe(snapshot.capturedAt);
			expect(snapshot.capturedAtSource).toBe('import-time');
			expect(snapshot.stats.shotsFired).toBeNull();
			expect(snapshot.stats.extra).toEqual({});
		}
	});

	it('ignores unknown extra statistics from newer versions', () => {
		const snapshot = makeSnapshot(0);
		const raw = { ...snapshot, stats: { ...snapshot.stats, extra: { totalXp: 5, futureStat: 9 } } };
		const result = parseBackup(withSnapshots([raw]));
		expect(result.ok && result.snapshots[0].stats.extra).toEqual({ totalXp: 5 });
	});
});

describe('planImport', () => {
	it('adds new snapshots and leaves existing ones alone', () => {
		const existing = [makeSnapshot(0)];
		const incoming = [makeSnapshot(5, { kills: 2000 })];
		const plan = planImport(existing, incoming);
		expect(plan.toAdd).toEqual(incoming);
		expect(plan.duplicates).toEqual([]);
	});

	it('skips a snapshot with an existing id even if its values differ', () => {
		const existing = makeSnapshot(0);
		const clash = { ...makeSnapshot(9, { kills: 9999 }), id: existing.id };
		const plan = planImport([existing], [clash]);
		expect(plan.toAdd).toEqual([]);
		expect(plan.duplicates[0].reason).toBe('id');
	});

	it('skips a snapshot with the same date and identical values', () => {
		const existing = makeSnapshot(0);
		const copy = { ...makeSnapshot(0), id: 'another-id' };
		expect(planImport([existing], [copy]).duplicates[0].reason).toBe('content');
	});

	it('keeps identical values on a different date', () => {
		const existing = makeSnapshot(0);
		const later = makeSnapshot(5);
		expect(planImport([existing], [later]).toAdd).toEqual([later]);
	});

	it('keeps the same date with different values', () => {
		const existing = makeSnapshot(0);
		const other = makeSnapshot(0, { kills: 1234 });
		expect(planImport([existing], [other]).toAdd).toEqual([other]);
	});

	it('skips duplicates within the file itself', () => {
		const a = makeSnapshot(1);
		const plan = planImport([], [a, { ...a }]);
		expect(plan.toAdd).toHaveLength(1);
		expect(plan.duplicates).toHaveLength(1);
	});
});

describe('findDuplicate', () => {
	const stats = makeStats();

	it('finds identical stats at the nearest earlier snapshot', () => {
		const earlier = makeSnapshot(0);
		expect(findDuplicate([earlier], stats, makeSnapshot(3).capturedAt)).toBe(earlier);
	});

	it('finds identical stats at the nearest later snapshot', () => {
		const later = makeSnapshot(5);
		expect(findDuplicate([later], stats, makeSnapshot(3).capturedAt)).toBe(later);
	});

	it('ignores identical stats that are not adjacent', () => {
		const old = makeSnapshot(0);
		const between = makeSnapshot(2, { kills: 1500 });
		expect(findDuplicate([old, between], stats, makeSnapshot(3).capturedAt)).toBeNull();
	});

	it('finds nothing when values differ', () => {
		expect(
			findDuplicate([makeSnapshot(0)], makeStats({ kills: 1 }), makeSnapshot(1).capturedAt)
		).toBeNull();
	});
});
