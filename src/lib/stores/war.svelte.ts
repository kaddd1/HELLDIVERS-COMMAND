import { resolve } from '$app/paths';
import { describeChanges, type OrderChanges } from '../war/majorOrders.ts';
import type { MajorOrdersPayload, UpstreamFailure } from '../war/source.ts';

type Status = 'idle' | 'loading' | 'ready' | 'error';
export type LoadError = UpstreamFailure | 'offline';

/** What the last manual refresh actually achieved. */
export type RefreshResult =
	| { kind: 'updated'; at: number; changes: OrderChanges }
	| { kind: 'unchanged'; at: number }
	| { kind: 'cached'; at: number; ageMs: number }
	| { kind: 'error'; at: number; error: LoadError };

/** Data younger than this is reused when the page is opened again without a request. */
const FRESH_MS = 60_000;
const STORAGE_KEY = 'major-orders';

function isPayload(value: unknown): value is MajorOrdersPayload {
	const candidate = value as Partial<MajorOrdersPayload> | null;
	return (
		typeof candidate === 'object' &&
		candidate !== null &&
		Array.isArray(candidate.orders) &&
		typeof candidate.fetchedAt === 'string' &&
		!Number.isNaN(Date.parse(candidate.fetchedAt))
	);
}

function readSaved(): MajorOrdersPayload | null {
	try {
		const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
		return isPayload(saved) ? saved : null;
	} catch {
		return null;
	}
}

function save(payload: MajorOrdersPayload): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	} catch {
		// Storage can be unavailable or full; the page works without it.
	}
}

function time(payload: MajorOrdersPayload): number {
	return Date.parse(payload.fetchedAt);
}

class MajorOrdersStore {
	status = $state<Status>('idle');
	refreshing = $state(false);
	payload = $state.raw<MajorOrdersPayload | null>(null);
	error = $state<LoadError | null>(null);
	/** Server clock minus client clock; keeps the countdown right even if the device clock is off. */
	clockOffsetMs = $state(0);

	/** Outcome of the last manual refresh, for feedback next to the button. */
	result = $state.raw<RefreshResult | null>(null);
	/** Client time (ms) before which a refresh would not reach the API; `null` when unknown. */
	nextRefreshAt = $state<number | null>(null);
	/** Length of the current wait, for the progress bar on the button. */
	waitTotalMs = $state(0);
	/** Counters that just changed, so the card can highlight them. */
	pulse = $state.raw<OrderChanges['progress']>([]);
	pulseToken = $state(0);

	private checkedAt = 0;

	/**
	 * Fetches the orders. Network responses are never taken from the HTTP cache. A response is
	 * applied only if it is not older than what is already shown, so a slow or out-of-date answer
	 * (another server instance, a late request) cannot roll the page back.
	 */
	async load(force = false): Promise<void> {
		if (this.refreshing) return;

		if (!this.payload) {
			const saved = readSaved();
			if (saved) {
				this.payload = saved;
				this.status = 'ready';
			}
		}
		if (!force && this.payload && !this.error && Date.now() - this.checkedAt < FRESH_MS) return;

		const previous = this.payload;
		this.refreshing = true;
		if (!this.payload) this.status = 'loading';
		try {
			const response = await fetch(`${resolve('/api/major-orders')}${force ? '?refresh=1' : ''}`, {
				cache: 'no-store'
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as {
					error?: UpstreamFailure;
					retryAt?: string | null;
				} | null;
				this.fail(body?.error ?? 'status', force, body?.retryAt ?? null);
				return;
			}
			const incoming = (await response.json()) as MajorOrdersPayload;
			if (!isPayload(incoming)) {
				this.fail('invalid', force, null);
				return;
			}
			this.clockOffsetMs = Date.parse(incoming.serverNow) - Date.now();
			this.checkedAt = Date.now();
			this.error = incoming.failure;
			this.waitUntil(incoming.nextRefreshAt);

			const isNewer = !previous || time(incoming) > time(previous);
			if (!previous || time(incoming) >= time(previous)) {
				this.payload = incoming;
				if (!incoming.stale) save(incoming);
			}
			this.status = 'ready';
			if (force) this.report(incoming, previous, isNewer);
		} catch {
			this.fail('offline', force, null);
		} finally {
			this.refreshing = false;
		}
	}

	/** Describes honestly what a manual refresh did: new data, no change, cached copy, or failure. */
	private report(
		incoming: MajorOrdersPayload,
		previous: MajorOrdersPayload | null,
		isNewer: boolean
	): void {
		const at = Date.now();
		if (incoming.failure) {
			this.result = { kind: 'error', at, error: incoming.failure };
		} else if (incoming.fromCache || !isNewer) {
			const ageMs = Math.max(0, Date.parse(incoming.serverNow) - time(incoming));
			this.result = { kind: 'cached', at, ageMs };
		} else {
			const changes = describeChanges(previous?.orders ?? [], incoming.orders);
			const changed = changes.structural || changes.progress.length > 0;
			this.result = changed ? { kind: 'updated', at, changes } : { kind: 'unchanged', at };
			if (changes.progress.length > 0) {
				this.pulse = changes.progress;
				this.pulseToken++;
			}
		}
	}

	private waitUntil(serverIso: string | null): void {
		const target = serverIso ? Date.parse(serverIso) - this.clockOffsetMs : Number.NaN;
		if (Number.isNaN(target)) {
			this.nextRefreshAt = null;
			return;
		}
		this.nextRefreshAt = target;
		this.waitTotalMs = Math.max(0, target - Date.now());
	}

	/** Keeps the last known data on screen when a request fails; shows an error only if there is none. */
	private fail(error: LoadError, force: boolean, retryAt: string | null): void {
		this.error = error;
		this.waitUntil(retryAt);
		if (force) this.result = { kind: 'error', at: Date.now(), error };
		if (!this.payload) this.status = 'error';
	}
}

export const majorOrders = new MajorOrdersStore();
