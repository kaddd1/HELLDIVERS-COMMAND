import type { OcrWord } from './types.ts';

const TEXT_HEIGHT = 20;
const ROW_PITCH = 55;
const CHAR_WIDTH = 11;

export interface RowSpec {
	label: string;
	value: string;
}

export const SCREEN_ONE: RowSpec[] = [
	{ label: 'Убито врагов', value: '40 002' },
	{ label: 'Убито жуков', value: '17 571' },
	{ label: 'Убито автоматонов', value: '14 083' },
	{ label: 'Убито просветленных', value: '8 348' },
	{ label: 'Убито своих', value: '94' },
	{ label: 'Убито гранатами', value: '1 230' },
	{ label: 'Убито в ближнем бою', value: '83' },
	{ label: 'Убито «Орлом»', value: '5 852' },
	{ label: 'Смертей', value: '886' },
	{ label: 'Сделано выстрелов', value: '230 523' },
	{ label: 'Попаданий', value: '137 458' },
	{ label: 'Прим. орбитальной поддержки', value: '620' },
	{ label: 'Прим. защитных стратагем', value: '626' },
	{ label: 'Прим. стратагем «Орла»', value: '1 531' }
];

/** The list scrolled to the end; the first four rows overlap with `SCREEN_ONE`. */
export const SCREEN_TWO: RowSpec[] = [
	{ label: 'Попаданий', value: '137 458' },
	{ label: 'Прим. орбитальной поддержки', value: '620' },
	{ label: 'Прим. защитных стратагем', value: '626' },
	{ label: 'Прим. стратагем «Орла»', value: '1 531' },
	{ label: 'Прим. стратагем снабжения', value: '893' },
	{ label: 'Прим. стратагем подкрепления', value: '819' },
	{ label: 'Применено стратагем', value: '4 799' },
	{ label: 'Успешных эвакуаций', value: '237' },
	{ label: 'Достигнуто целей', value: '1 392' },
	{ label: 'Сыграно заданий', value: '281' },
	{ label: 'Выполнено заданий', value: '262' },
	{ label: 'Время в заданиях', value: '95:54:28' },
	{ label: 'Собрано образцов', value: '4 075' },
	{ label: 'Всего получено опыта', value: '394 150' }
];

function word(text: string, x0: number, y0: number, confidence: number): OcrWord {
	return {
		text,
		confidence,
		bbox: { x0, y0, x1: x0 + text.length * CHAR_WIDTH, y1: y0 + TEXT_HEIGHT }
	};
}

export interface LayoutOptions {
	left?: number;
	right?: number;
	top?: number;
	confidence?: number;
}

export function rowsToWords(rows: RowSpec[], options: LayoutOptions = {}): OcrWord[] {
	const { left = 20, right = 480, top = 30, confidence = 92 } = options;
	const words: OcrWord[] = [];

	rows.forEach((row, index) => {
		const y = top + index * ROW_PITCH;

		let x = left;
		for (const token of row.label.split(' ')) {
			words.push(word(token, x, y, confidence));
			x += (token.length + 1) * CHAR_WIDTH;
		}

		const tokens = row.value.split(' ');
		const totalWidth = tokens.reduce((sum, t) => sum + (t.length + 1) * CHAR_WIDTH, 0) - CHAR_WIDTH;
		x = right - totalWidth;
		for (const token of tokens) {
			words.push(word(token, x, y, confidence));
			x += (token.length + 1) * CHAR_WIDTH;
		}
	});
	return words;
}

export function headerWords(name: string, level: number, left = 800, top = 170): OcrWord[] {
	return [
		word('|', left - 40, top, 90),
		word(name, left, top, 88),
		word('Уровень', left, top + 24, 95),
		word(String(level), left + 90, top + 24, 94),
		word('|', left + 125, top + 24, 90),
		word('[ТЕГ]', left + 140, top + 24, 80)
	];
}

/** Deterministic shuffle so tests can prove that word order does not matter. */
export function shuffled<T>(items: T[]): T[] {
	const copy = [...items];
	let seed = 7;
	for (let i = copy.length - 1; i > 0; i--) {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		const j = seed % (i + 1);
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}
