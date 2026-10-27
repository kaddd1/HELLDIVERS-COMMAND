import { normalizeAssignments, type MajorOrder } from './majorOrders.ts';

export const UPSTREAM_URL = 'https://api.helldivers2.dev/api/v1/assignments';

/** Documented limit of the community API is 5 requests per 10 seconds. */
const DEFAULT_TTL_MS = 60_000;
const DEFAULT_MIN_REFRESH_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 8_000;
/** Pause before asking the API again after it failed or limited us. */
const FAILURE_BACKOFF_MS = 5_000;
const DEFAULT_RATE_LIMIT_PAUSE_MS = 30_000;
const MAX_RATE_LIMIT_PAUSE_MS = 5 * 60_000;

export type UpstreamFailure = 'network' | 'rate-limit' | 'status' | 'invalid';

export class UpstreamError extends Error {
	constructor(
		readonly reason: UpstreamFailure,
		/** Epoch milliseconds before which the API should not be asked again. */
		readonly retryAtMs: number | null = null
	) {
		super(reason);
	}
}

export interface MajorOrdersPayload {
	orders: MajorOrder[];
	/** Language of the order texts as reported by the API, e.g. `ru-RU`. */
	language: string | null;
	/** When the data was last fetched successfully from the API, ISO 8601. */
	fetchedAt: string;
	/** Server clock at the time of the response, used to correct the client's countdown. */
	serverNow: string;
	/** The API failed and this is the last good copy. */
	stale: boolean;
	failure: UpstreamFailure | null;
	/** True when no request to the API was made for this response (the cached copy was reused). */
	fromCache: boolean;
	/** Earliest moment a refresh would actually query the API again, ISO 8601. */
	nextRefreshAt: string;
}

export interface SourceOptions {
	fetch: typeof fetch;
	now: () => number;
	client: string;
	contact: string;
	ttlMs?: number;
	minRefreshMs?: number;
	timeoutMs?: number;
}

interface Cached {
	orders: MajorOrder[];
	language: string | null;
	fetchedAtMs: number;
}

function retryAfterMs(response: Response): number {
	const seconds = Number(response.headers.get('retry-after'));
	if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_RATE_LIMIT_PAUSE_MS;
	return Math.min(seconds * 1000, MAX_RATE_LIMIT_PAUSE_MS);
}

/**
 * Fetches Major Orders from the community API with a short in-memory cache, so many visitors or
 * refresh clicks cannot exceed the API's rate limit. If the API fails, the last good copy is
 * served and marked stale, and the API is left alone for a short pause.
 */
export function createMajorOrdersSource(options: SourceOptions) {
	const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
	const minRefresh = options.minRefreshMs ?? DEFAULT_MIN_REFRESH_MS;
	const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

	let cache: Cached | null = null;
	let inflight: Promise<Cached> | null = null;
	let pausedUntil = 0;

	async function fetchUpstream(): Promise<Cached> {
		let response: Response;
		try {
			response = await options.fetch(UPSTREAM_URL, {
				headers: {
					Accept: 'application/json',
					'Accept-Language': 'ru-RU',
					'X-Super-Client': options.client,
					'X-Super-Contact': options.contact
				},
				signal: AbortSignal.timeout(timeout)
			});
		} catch {
			throw new UpstreamError('network');
		}
		if (response.status === 429) {
			throw new UpstreamError('rate-limit', options.now() + retryAfterMs(response));
		}
		if (!response.ok) throw new UpstreamError('status');

		let body: unknown;
		try {
			body = await response.json();
		} catch {
			throw new UpstreamError('invalid');
		}
		if (!Array.isArray(body)) throw new UpstreamError('invalid');

		return {
			orders: normalizeAssignments(body),
			language: response.headers.get('content-language'),
			fetchedAtMs: options.now()
		};
	}

	function nextRefreshMs(data: Cached): number {
		return Math.max(data.fetchedAtMs + minRefresh, pausedUntil);
	}

	function toPayload(
		data: Cached,
		failure: UpstreamFailure | null,
		fromCache: boolean
	): MajorOrdersPayload {
		return {
			orders: data.orders,
			language: data.language,
			fetchedAt: new Date(data.fetchedAtMs).toISOString(),
			serverNow: new Date(options.now()).toISOString(),
			stale: failure !== null,
			failure,
			fromCache,
			nextRefreshAt: new Date(nextRefreshMs(data)).toISOString()
		};
	}

	return {
		/** `force` allows a refresh sooner than the normal cache lifetime, but not faster than a safe minimum. */
		async get(force = false): Promise<MajorOrdersPayload> {
			const now = options.now();
			const limit = force ? minRefresh : ttl;
			const paused = now < pausedUntil;

			if (cache && !paused && now - cache.fetchedAtMs < limit) {
				return toPayload(cache, null, true);
			}
			if (paused) {
				if (cache) return toPayload(cache, 'rate-limit', true);
				throw new UpstreamError('rate-limit', pausedUntil);
			}

			inflight ??= fetchUpstream().finally(() => {
				inflight = null;
			});
			try {
				cache = await inflight;
				return toPayload(cache, null, false);
			} catch (error) {
				const failure = error instanceof UpstreamError ? error.reason : 'network';
				const retryAt = error instanceof UpstreamError ? error.retryAtMs : null;
				pausedUntil = Math.max(pausedUntil, retryAt ?? options.now() + FAILURE_BACKOFF_MS);
				if (cache) return toPayload(cache, failure, false);
				throw new UpstreamError(failure, pausedUntil);
			}
		}
	};
}
