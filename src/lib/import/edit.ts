import { getDefinition, type StatKey } from '../domain/statDefinitions.ts';
import { parseDuration } from './parse.ts';

const MAX_VALUE = 1_000_000_000_000;

/**
 * Parses a value typed by the user while correcting a statistic. Accepts digits with optional
 * thousands separators ("40 002") or, for durations, "h:mm:ss". Returns `null` if invalid.
 */
export function parseEditedValue(key: StatKey, text: string): number | null {
	const trimmed = text.trim();
	if (trimmed === '') return null;

	if (getDefinition(key).kind === 'duration') return parseDuration(trimmed);

	const digits = trimmed.replace(/[\s.,]/g, '');
	if (!/^\d+$/.test(digits)) return null;
	const value = Number(digits);
	return value <= MAX_VALUE ? value : null;
}
