import { describe, expect, it } from 'vitest';
import {
	DATES_DIFFER_AFTER_MS,
	defaultCaptureDate,
	detectDateSource,
	parseLocalInput,
	toLocalInputValue
} from './captureDate.ts';

const NOW = new Date(2026, 5, 1, 12, 0, 0);

describe('defaultCaptureDate', () => {
	it('uses the file date', () => {
		const file = new Date(2026, 4, 30, 20, 15);
		const result = defaultCaptureDate([file, null], NOW);
		expect(result).toEqual({ date: file, source: 'file', differ: false });
	});

	it('suggests the later date and does not warn when files are taken minutes apart', () => {
		const first = new Date(2026, 4, 30, 20, 15);
		const second = new Date(2026, 4, 30, 20, 17);
		const result = defaultCaptureDate([first, second], NOW);
		expect(result.date).toEqual(second);
		expect(result.differ).toBe(false);
	});

	it('warns when file dates are far apart', () => {
		const first = new Date(2026, 4, 1, 20, 0);
		const second = new Date(first.getTime() + DATES_DIFFER_AFTER_MS + 60_000);
		expect(defaultCaptureDate([first, second], NOW).differ).toBe(true);
	});

	it('falls back to the current time without usable file dates', () => {
		expect(defaultCaptureDate([null, null], NOW)).toEqual({
			date: NOW,
			source: 'import-time',
			differ: false
		});
		expect(defaultCaptureDate([new Date(0), new Date(Number.NaN)], NOW).source).toBe('import-time');
	});
});

describe('datetime-local helpers', () => {
	it('round-trips through the input format in local time', () => {
		const date = new Date(2026, 2, 5, 7, 9);
		const text = toLocalInputValue(date);
		expect(text).toBe('2026-03-05T07:09');
		expect(parseLocalInput(text)?.getTime()).toBe(date.getTime());
	});

	it('rejects empty and malformed values', () => {
		expect(parseLocalInput('')).toBeNull();
		expect(parseLocalInput('2026-13-45T99:99')).toBeNull();
		expect(parseLocalInput('yesterday')).toBeNull();
	});
});

describe('detectDateSource', () => {
	const file = new Date(2026, 4, 30, 20, 15, 42);

	it('reports a file date when the chosen minute matches', () => {
		expect(detectDateSource(new Date(2026, 4, 30, 20, 15), [file, null], 'file')).toBe('file');
	});

	it('reports a user date when it was changed', () => {
		expect(detectDateSource(new Date(2026, 4, 29, 10, 0), [file, null], 'file')).toBe('user');
	});

	it('reports the import time only when no file date was usable', () => {
		expect(detectDateSource(new Date(), [null, null], 'import-time')).toBe('import-time');
		expect(detectDateSource(new Date(2020, 0, 1), [null, null], 'import-time')).toBe('user');
	});
});
