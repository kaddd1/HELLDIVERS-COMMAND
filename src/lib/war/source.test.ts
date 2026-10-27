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

	it('returns an empty list when there are no active orders', async () => {
		const { source } = setup([() => response([])]);
		expect((await source.get()).orders).toEqual([]);
	});
});
