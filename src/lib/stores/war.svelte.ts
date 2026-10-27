import { resolve } from '$app/paths';
import type { MajorOrdersPayload, UpstreamFailure } from '../war/source.ts';

type Status = 'idle' | 'loading' | 'ready' | 'error';
export type LoadError = UpstreamFailure | 'offline';

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

		this.refreshing = true;
		if (!this.payload) this.status = 'loading';
		try {
			const response = await fetch(`${resolve('/api/major-orders')}${force ? '?refresh=1' : ''}`, {
				cache: 'no-store'
			});
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as {
					error?: UpstreamFailure;
				} | null;
				this.fail(body?.error ?? 'status');
				return;
			}
			const incoming = (await response.json()) as MajorOrdersPayload;
			if (!isPayload(incoming)) {
				this.fail('invalid');
				return;
			}
			this.clockOffsetMs = Date.parse(incoming.serverNow) - Date.now();
			this.checkedAt = Date.now();
			this.error = incoming.failure;
			if (!this.payload || time(incoming) >= time(this.payload)) {
				this.payload = incoming;
				if (!incoming.stale) save(incoming);
			}
			this.status = 'ready';
		} catch {
			this.fail('offline');
		} finally {
			this.refreshing = false;
		}
	}

	/** Keeps the last known data on screen when a request fails; shows an error only if there is none. */
	private fail(error: LoadError): void {
		this.error = error;
		if (!this.payload) this.status = 'error';
	}
}

export const majorOrders = new MajorOrdersStore();
