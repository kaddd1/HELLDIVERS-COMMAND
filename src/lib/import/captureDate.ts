import type { CapturedAtSource } from '../domain/stats.ts';

/** File dates further apart than this suggest the screenshots were not taken together. */
export const DATES_DIFFER_AFTER_MS = 10 * 60 * 1000;
/** A statistics date later than now plus this margin cannot be right. */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface DefaultDate {
	date: Date;
	source: CapturedAtSource;
	differ: boolean;
}

function valid(date: Date | null): date is Date {
	return date !== null && !Number.isNaN(date.getTime()) && date.getTime() > 0;
}

/**
 * Suggests the statistics date from the screenshot files. A file's modification date is only a
 * hint (copying or editing a file changes it), so the user can always override the result.
 * With two usable dates the later one is suggested: it reflects the last values seen.
 */
export function defaultCaptureDate(fileDates: (Date | null)[], now: Date): DefaultDate {
	const dates = fileDates.filter(valid);
	if (dates.length === 0) return { date: now, source: 'import-time', differ: false };

	const times = dates.map((d) => d.getTime());
	const latest = Math.max(...times);
	const earliest = Math.min(...times);
	return {
		date: new Date(latest),
		source: 'file',
		differ: dates.length > 1 && latest - earliest > DATES_DIFFER_AFTER_MS
	};
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

export function toLocalInputValue(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalInput(value: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function detectDateSource(
	chosen: Date,
	fileDates: (Date | null)[],
	suggestedSource: CapturedAtSource
): CapturedAtSource {
	const minute = toLocalInputValue(chosen);
	const matchesFile = fileDates.some((d) => valid(d) && toLocalInputValue(d) === minute);
	if (matchesFile) return 'file';
	return suggestedSource === 'import-time' && Math.abs(Date.now() - chosen.getTime()) < 120_000
		? 'import-time'
		: 'user';
}

export function fileDate(file: File | null): Date | null {
	return file ? new Date(file.lastModified) : null;
}

/** The current moment; a function so reactive code does not construct dates itself. */
export function currentDate(): Date {
	return new Date();
}
