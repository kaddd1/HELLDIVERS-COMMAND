import type { PlayerProfile, StatsSnapshot } from '../domain/stats.ts';

const DB_NAME = 'helldivers-command';
const DB_VERSION = 1;
const PROFILE_STORE = 'profile';
const SNAPSHOT_STORE = 'snapshots';

function promisify<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionDone(tx: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	dbPromise ??= new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			reject(new Error('IndexedDB is not available'));
			return;
		}
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			db.createObjectStore(PROFILE_STORE, { keyPath: 'id' });
			db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	// Allow a retry after a failed open.
	dbPromise.catch(() => {
		dbPromise = null;
	});
	return dbPromise;
}

/** Fills in fields that snapshots saved by earlier versions of the app do not have. */
function normalizeSnapshot(snapshot: StatsSnapshot): StatsSnapshot {
	const stats = snapshot.stats;
	return {
		...snapshot,
		importedAt: snapshot.importedAt ?? snapshot.capturedAt,
		capturedAtSource: snapshot.capturedAtSource ?? 'import-time',
		stats: { ...stats, rankTitle: stats.rankTitle ?? null, extra: stats.extra ?? {} }
	};
}

export async function loadProfile(): Promise<PlayerProfile | null> {
	const db = await openDb();
	const profile = await promisify<PlayerProfile | undefined>(
		db.transaction(PROFILE_STORE).objectStore(PROFILE_STORE).get('me')
	);
	return profile ?? null;
}

export async function loadSnapshots(): Promise<StatsSnapshot[]> {
	const db = await openDb();
	const all = await promisify<StatsSnapshot[]>(
		db.transaction(SNAPSHOT_STORE).objectStore(SNAPSHOT_STORE).getAll()
	);
	return all.map(normalizeSnapshot).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export async function saveProfileAndSnapshots(
	profile: PlayerProfile | null,
	snapshots: readonly StatsSnapshot[]
): Promise<void> {
	const db = await openDb();
	const tx = db.transaction([PROFILE_STORE, SNAPSHOT_STORE], 'readwrite');
	if (profile) tx.objectStore(PROFILE_STORE).put(profile);
	for (const snapshot of snapshots) tx.objectStore(SNAPSHOT_STORE).put(snapshot);
	await transactionDone(tx);
}

export async function deleteSnapshot(id: string): Promise<void> {
	const db = await openDb();
	const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
	tx.objectStore(SNAPSHOT_STORE).delete(id);
	await transactionDone(tx);
}
