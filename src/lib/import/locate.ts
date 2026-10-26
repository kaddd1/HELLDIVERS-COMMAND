import { groupRows, isNumericToken, matchLabel } from './parse.ts';
import type { Region } from './preprocess.ts';
import { normalizeLabel, similarity } from './text.ts';
import type { OcrWord } from './types.ts';

export interface Layout {
	panel: Region | null;
	header: Region | null;
}

const MIN_PANEL_ROWS = 3;

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

function clamp(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/**
 * Finds where the stats list and the player header are, using a coarse full-frame OCR result.
 * Only geometry is taken from this pass; values are read later from tight crops, so a noisy
 * full-frame pass cannot introduce wrong numbers.
 *
 * `width` and `height` are the size of the image the words were recognized in.
 */
export function locateLayout(words: OcrWord[], width: number, height: number): Layout {
	const rows = groupRows(words);

	const known: { x0: number; x1: number; y0: number; y1: number }[] = [];
	for (const row of rows) {
		const firstNumber = row.findIndex((w) => isNumericToken(w.text));
		if (firstNumber <= 0) continue;

		const label = row.slice(0, firstNumber);
		if (!matchLabel(label.map((w) => w.text).join(' '))) continue;

		let last = firstNumber;
		while (last + 1 < row.length && isNumericToken(row[last + 1].text)) last++;
		const used = row.slice(0, last + 1);
		known.push({
			x0: label[0].bbox.x0,
			x1: row[last].bbox.x1,
			y0: Math.min(...used.map((w) => w.bbox.y0)),
			y1: Math.max(...used.map((w) => w.bbox.y1))
		});
	}

	let panel: Region | null = null;
	if (known.length >= MIN_PANEL_ROWS) {
		const centers = known.map((k) => (k.y0 + k.y1) / 2).sort((a, b) => a - b);
		const steps = centers.slice(1).map((c, i) => c - centers[i]);
		const pitch = Math.max(median(steps), median(known.map((k) => k.y1 - k.y0)));
		const padX = pitch * 0.6;
		panel = {
			x0: clamp((median(known.map((k) => k.x0)) - padX) / width),
			x1: clamp((median(known.map((k) => k.x1)) + padX) / width),
			y0: clamp((Math.min(...known.map((k) => k.y0)) - pitch * 1.5) / height),
			y1: clamp((Math.max(...known.map((k) => k.y1)) + pitch * 1.5) / height)
		};
	}

	let header: Region | null = null;
	for (const row of rows) {
		const label = row.find((w) => similarity(normalizeLabel(w.text), 'уровень') >= 0.75);
		if (!label) continue;
		const textHeight = label.bbox.y1 - label.bbox.y0;
		const centerY = (label.bbox.y0 + label.bbox.y1) / 2;
		header = {
			x0: clamp((label.bbox.x0 - textHeight) / width),
			x1: clamp((label.bbox.x0 + 0.3 * height) / width),
			y0: clamp((centerY - 3.2 * textHeight) / height),
			y1: clamp((centerY + 1.5 * textHeight) / height)
		};
		break;
	}

	return { panel, header };
}
