import { describe, expect, it, vi } from 'vitest';
import { LIVE_ASSIGNMENTS } from './fixtures.ts';
import { UPSTREAM_URL, UpstreamError, createMajorOrdersSource } from './source.ts';

function response(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		headers: { 'content-language': 'ru-RU', ...init.headers },
		status: init.status ?? 200
	});
}

function setup(responses: (() => Response | Promise<Response>)[]) {
	let time = 1_000_000;
	const queue = [...responses];
	const fetchMock = vi.fn(async () => {
		const next = queue.shift() ?? queue[0];
		if (!next) throw new Error('no response');
		return next();
	});
	const source = createMajorOrdersSource({
		fetch: fetchMock as unknown as typeof fetch,
		now: () => time,
		client: 'Test-Client',
		contact: 'https://example.test/contact'
	});
	return {
		source,
		fetchMock,
		advance: (ms: number) => {
			time += ms;
		}
	};
}

const ok = () => response(LIVE_ASSIGNMENTS);

describe('createMajorOrdersSource', () => {
	it('sends the required identification headers and asks for Russian', async () => {
		const { source, fetchMock } = setup([ok]);
		await source.get();
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe(UPSTREAM_URL);
		expect(init.headers).toMatchObject({
			'X-Super-Client': 'Test-Client',
			'X-Super-Contact': 'https://example.test/contact',
			'Accept-Language': 'ru-RU'
		});
	});

	it('returns normalized orders with language and timestamps', async () => {
		const { source } = setup([ok]);
		const payload = await source.get();
		expect(payload.orders).toHaveLength(1);
		expect(payload.language).toBe('ru-RU');
		expect(payload.stale).toBe(false);
		expect(payload.failure).toBeNull();
		expect(payload.fetchedAt).toBe(new Date(1_000_000).toISOString());
	});

	it('serves repeated requests from the cache within its lifetime', async () => {
		const { source, fetchMock, advance } = setup([ok]);
		await source.get();
		advance(30_000);
		await source.get();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		advance(31_000);
		await source.get();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('limits forced refreshes so the API rate limit is not exceeded', async () => {
		const { source, fetchMock, advance } = setup([ok]);
		await source.get();
		advance(5_000);
		await source.get(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		advance(11_000);
		await source.get(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('shares one upstream request between concurrent callers', async () => {
		const { source, fetchMock } = setup([ok]);
		await Promise.all([source.get(), source.get(), source.get()]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('serves the last good copy, marked stale, when the API fails', async () => {
		const { source, advance } = setup([ok, () => response({}, { status: 500 })]);
		await source.get();
		advance(120_000);
		const payload = await source.get();
		expect(payload.stale).toBe(true);
		expect(payload.failure).toBe('status');
		expect(payload.orders).toHaveLength(1);
		expect(payload.fetchedAt).toBe(new Date(1_000_000).toISOString());
	});

	it.each([
		['network', () => Promise.reject(new TypeError('offline'))],
		['rate-limit', () => response({}, { status: 429 })],
		['status', () => response({}, { status: 503 })],
		['invalid', () => response({ not: 'a list' })],
		['invalid', () => new Response('<html>', { status: 200 })]
	] as const)('reports a %s failure when there is nothing cached', async (reason, make) => {
		const { source } = setup([make as () => Response]);
		await expect(source.get()).rejects.toMatchObject({ reason });
		await expect(source.get()).rejects.toBeInstanceOf(UpstreamError);
	});

	it('marks cached answers so the client does not present them as fresh', async () => {
		const { source, advance } = setup([ok]);
		const first = await source.get();
		expect(first.fromCache).toBe(false);
		advance(5_000);
		const second = await source.get(true);
		expect(second.fromCache).toBe(true);
		expect(second.fetchedAt).toBe(first.fetchedAt);
	});

	it('tells when a refresh would reach the API again', async () => {
		const { source } = setup([ok]);
		const payload = await source.get();
		expect(Date.parse(payload.nextRefreshAt)).toBe(Date.parse(payload.fetchedAt) + 15_000);
	});

	it('pauses requests after a rate limit, honouring Retry-After', async () => {
		const { source, fetchMock, advance } = setup([
			ok,
			() => response({}, { status: 429, headers: { 'retry-after': '40' } }),
			ok
		]);
		await source.get();
		advance(120_000);
		const limited = await source.get();
		expect(limited.failure).toBe('rate-limit');
		expect(limited.stale).toBe(true);
		expect(Date.parse(limited.nextRefreshAt)).toBe(Date.parse(limited.serverNow) + 40_000);

		advance(20_000);
		const during = await source.get(true);
		expect(during.failure).toBe('rate-limit');
		expect(fetchMock).toHaveBeenCalledTimes(2);

		advance(21_000);
		const after = await source.get(true);
		expect(after.failure).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('reports when to retry if the API fails and nothing is cached', async () => {
		const { source } = setup([() => response({}, { status: 429 })]);
		await expect(source.get()).rejects.toMatchObject({
			reason: 'rate-limit',
			retryAtMs: 1_030_000
		});
	});

	it('backs off briefly after any failure instead of hammering the API', async () => {
		const { source, fetchMock, advance } = setup([() => response({}, { status: 500 }), ok]);
		await expect(source.get()).rejects.toMatchObject({ reason: 'status' });
		advance(2_000);
		await expect(source.get()).rejects.toMatchObject({ reason: 'rate-limit' });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		advance(4_000);
		expect((await source.get()).failure).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('returns an empty list when there are no active orders', async () => {
		const { source } = setup([() => response([])]);
		expect((await source.get()).orders).toEqual([]);
	});
});
