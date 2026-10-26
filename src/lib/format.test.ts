import { describe, expect, it } from 'vitest';
import {
	changeOfCount,
	changeOfRatio,
	formatDuration,
	formatElapsed,
	formatRatio
} from './format.ts';

describe('changeOfCount', () => {
	it('shows growth, decline and no change', () => {
		expect(changeOfCount(1500, 300)).toEqual({ text: '+1 200', direction: 'up' });
		expect(changeOfCount(5, 8)).toEqual({ text: '−3', direction: 'down' });
		expect(changeOfCount(5, 5)).toEqual({ text: '0', direction: 'flat' });
	});
});

describe('changeOfRatio', () => {
	it('shows decimal ratios with two digits', () => {
		expect(changeOfRatio(45.15, 44.9, 'decimal')).toEqual({ text: '+0,25', direction: 'up' });
		expect(changeOfRatio(3, 3.5, 'decimal')?.direction).toBe('down');
	});

	it('shows shares as percentage points', () => {
		const change = changeOfRatio(0.6, 0.5, 'percent');
		expect(change?.text).toContain('п.п.');
		expect(change?.direction).toBe('up');
	});

	it('treats a change that rounds to zero as no change', () => {
		expect(changeOfRatio(0.5001, 0.5, 'percent')?.direction).toBe('flat');
	});

	it('returns null when a value is unknown', () => {
		expect(changeOfRatio(null, 1, 'decimal')).toBeNull();
		expect(changeOfRatio(1, null, 'decimal')).toBeNull();
	});
});

describe('formatting', () => {
	it('formats durations as h:mm:ss', () => {
		expect(formatDuration(345268)).toBe('95:54:28');
		expect(formatDuration(65)).toBe('0:01:05');
	});

	it('shows unavailable ratios as a dash', () => {
		expect(formatRatio(null, 'decimal')).toBe('—');
		expect(formatRatio(null, 'percent')).toBe('—');
	});

	it('describes elapsed time in suitable units', () => {
		expect(formatElapsed(3 * 86400)).toBe('3 дн.');
		expect(formatElapsed(5 * 3600)).toBe('5 ч');
		expect(formatElapsed(10 * 60)).toBe('10 мин');
	});
});
