import { json } from '@sveltejs/kit';
import { UpstreamError, createMajorOrdersSource } from '#lib/war/source.ts';
import type { RequestHandler } from './$types';

const CLIENT_NAME = 'Helldivers-Command-Center';
/** The API requires a contact; override it with the HD2_API_CONTACT environment variable. */
const DEFAULT_CONTACT = 'https://github.com/kaddd1/HELLDIVERS-COMMAND';

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
		const cacheable = !force && !payload.stale;
		return json(payload, {
			headers: {
				'Cache-Control': cacheable
					? 'public, max-age=0, s-maxage=60, stale-while-revalidate=120'
					: 'no-store'
			}
		});
	} catch (error) {
		const failure = error instanceof UpstreamError ? error.reason : 'network';
		return json({ error: failure }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
	}
};
