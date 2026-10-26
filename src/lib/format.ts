import { getDefinition, type StatKey } from './domain/statDefinitions.ts';
import { ru } from './i18n/ru.ts';

const LOCALE = 'ru-RU';

const integer = new Intl.NumberFormat(LOCALE);
const decimal = new Intl.NumberFormat(LOCALE, {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});
const percent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });

export function formatInt(value: number): string {
	return integer.format(value);
}

export function formatDecimal(value: number | null): string {
	return value === null ? ru.common.noValue : decimal.format(value);
}

export function formatPercent(value: number | null): string {
	return value === null ? ru.common.noValue : percent.format(value);
}

export function formatDateTime(iso: string): string {
	return dateTime.format(new Date(iso));
}

export function formatHours(seconds: number | null): string {
	if (seconds === null) return ru.common.noValue;
	return `${integer.format(Math.round(seconds / 3600))} ${ru.career.combat.hoursUnit}`;
}

export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const rest = seconds % 60;
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `${hours}:${pad(minutes)}:${pad(rest)}`;
}

export function formatStatValue(key: StatKey, value: number): string {
	return getDefinition(key).kind === 'duration' ? formatDuration(value) : formatInt(value);
}

export interface Change {
	text: string;
	direction: 'up' | 'down' | 'flat';
}

const signedDecimal = new Intl.NumberFormat(LOCALE, {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
	signDisplay: 'exceptZero'
});
const signedPercentPoints = new Intl.NumberFormat(LOCALE, {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	signDisplay: 'exceptZero'
});

export function changeOfCount(current: number, previous: number): Change {
	const diff = current - previous;
	if (diff === 0) return { text: '0', direction: 'flat' };
	return {
		text: `${diff > 0 ? '+' : '−'}${integer.format(Math.abs(diff))}`,
		direction: diff > 0 ? 'up' : 'down'
	};
}

/**
 * Difference of two ratios: decimals as "+0,12", shares as "+0,3 п.п.".
 * Returns `null` when either value is unknown.
 */
export function changeOfRatio(
	current: number | null,
	previous: number | null,
	format: 'decimal' | 'percent'
): Change | null {
	if (current === null || previous === null) return null;
	const diff = format === 'percent' ? (current - previous) * 100 : current - previous;
	const rounded = Math.round(diff * (format === 'percent' ? 10 : 100));
	if (rounded === 0) return { text: '0', direction: 'flat' };
	const text =
		format === 'percent'
			? `${signedPercentPoints.format(diff).replace('-', '−')} ${ru.overview.percentPoints}`
			: signedDecimal.format(diff).replace('-', '−');
	return { text, direction: rounded > 0 ? 'up' : 'down' };
}

export function formatRatio(value: number | null, format: 'decimal' | 'percent'): string {
	return format === 'percent' ? formatPercent(value) : formatDecimal(value);
}

const shortDate = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' });

export function formatDate(iso: string): string {
	return shortDate.format(new Date(iso));
}

export function formatElapsed(seconds: number): string {
	const days = seconds / 86400;
	if (days >= 1) return ru.analytics.comparison.days(integer.format(Math.round(days)));
	const hours = seconds / 3600;
	if (hours >= 1) return ru.analytics.comparison.hours(integer.format(Math.round(hours)));
	return ru.analytics.comparison.minutes(integer.format(Math.max(1, Math.round(seconds / 60))));
}
