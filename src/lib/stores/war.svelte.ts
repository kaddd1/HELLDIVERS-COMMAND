import { resolve } from '$app/paths';
import type { MajorOrdersPayload, UpstreamFailure } from '../war/source.ts';

type Status = 'idle' | 'loading' | 'ready' | 'error';
export type LoadError = UpstreamFailure | 'offline';

/** Data younger than this is reused when the page is opened again. */
const FRESH_MS = 60_000;

class MajorOrdersStore {
	status = $state<Status>('idle');
	refreshing = $state(false);
	payload = $state.raw<MajorOrdersPayload | null>(null);
	error = $state<LoadError | null>(null);
	/** Server clock minus client clock; keeps the countdown right even if the device clock is off. */
	clockOffsetMs = $state(0);

	private loadedAt = 0;

	async load(force = false): Promise<void> {
		if (this.refreshing) return;
		if (!force && this.payload && Date.now() - this.loadedAt < FRESH_MS) return;

		this.refreshing = true;
		if (!this.payload) this.status = 'loading';
		try {
			const response = await fetch(
				`${resolve('/api/major-orders')}${force ? '?refresh=1' : ''}`,
				force ? { cache: 'no-store' } : undefined
			);
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as {
					error?: UpstreamFailure;
				} | null;
				this.fail(body?.error ?? 'status');
				return;
			}
			const payload = (await response.json()) as MajorOrdersPayload;
			this.payload = payload;
			this.clockOffsetMs = Date.parse(payload.serverNow) - Date.now();
			this.loadedAt = Date.now();
			this.error = payload.failure;
			this.status = 'ready';
		} catch {
			this.fail('offline');
		} finally {
			this.refreshing = false;
		}
	}

	/** Keeps old data on screen when a refresh fails; shows an error only if there is none. */
	private fail(error: LoadError): void {
		this.error = error;
		if (!this.payload) this.status = 'error';
	}
}

export const majorOrders = new MajorOrdersStore();
