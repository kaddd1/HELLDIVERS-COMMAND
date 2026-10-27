import { json } from '@sveltejs/kit';
import { UpstreamError, createMajorOrdersSource } from '#lib/war/source.ts';
import type { RequestHandler } from './$types';

const CLIENT_NAME = 'Helldivers-Command-Center';
/** The API requires a contact; override it with the HD2_API_CONTACT environment variable. */
const DEFAULT_CONTACT = 'https://github.com/kaddd1/HELLDIVERS-COMMAND';

/**
 * Responses are never cached by browsers or a CDN: the server keeps its own short cache, and a
 * shared cache here would serve stale orders after a manual refresh.
 */
const NO_STORE = { 'Cache-Control': 'no-store' };

const source = createMajorOrdersSource({
	fetch: (...args) => fetch(...args),
	now: () => Date.now(),
	client: CLIENT_NAME,
	contact: process.env.HD2_API_CONTACT || DEFAULT_CONTACT
});

export const GET: RequestHandler = async ({ url }) => {
	const force = url.searchParams.has('refresh');
	try {
		const payload = await source.get(force);
		return json(payload, { headers: NO_STORE });
	} catch (error) {
		const failure = error instanceof UpstreamError ? error.reason : 'network';
		const retryAt = error instanceof UpstreamError ? error.retryAtMs : null;
		return json(
			{ error: failure, retryAt: retryAt === null ? null : new Date(retryAt).toISOString() },
			{ status: 503, headers: NO_STORE }
		);
	}
};
