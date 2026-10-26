import { STAT_DEFINITIONS, type StatKey } from '../domain/statDefinitions.ts';
import { normalizeLabel, similarity } from './text.ts';
import type { OcrWord, ParsedPass, RawNameObservation, RawObservation } from './types.ts';

/** Minimum label similarity to accept a match. */
const MATCH_THRESHOLD = 0.8;
/** The best match must beat the runner-up by this much, otherwise the label is ambiguous. */
const MATCH_MARGIN = 0.05;
/** Rows with fewer letters than this are not considered labels. */
const MIN_LABEL_LENGTH = 3;

const NUMERIC_TOKEN = /^\d[\d.,:]*$/;

export function isNumericToken(text: string): boolean {
	return NUMERIC_TOKEN.test(text);
}

const labelIndex = STAT_DEFINITIONS.filter((d) => d.key !== 'level').map((d) => ({
	key: d.key as StatKey,
	kind: d.kind as string,
	normalized: normalizeLabel(d.label)
}));

function yCenter(word: OcrWord): number {
	return (word.bbox.y0 + word.bbox.y1) / 2;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Groups words into visual rows by vertical position, regardless of how the OCR engine
 * segmented them into lines. Words in each row are ordered left to right.
 */
export function groupRows(words: OcrWord[]): OcrWord[][] {
	const usable = words.filter((w) => w.text.trim() !== '');
	if (usable.length === 0) return [];

	const tolerance = 0.6 * median(usable.map((w) => w.bbox.y1 - w.bbox.y0));
	const sorted = [...usable].sort((a, b) => yCenter(a) - yCenter(b));

	const rows: { words: OcrWord[]; sum: number }[] = [];
	for (const word of sorted) {
		const y = yCenter(word);
		const current = rows.at(-1);
		if (current && Math.abs(y - current.sum / current.words.length) <= tolerance) {
			current.words.push(word);
			current.sum += y;
		} else {
			rows.push({ words: [word], sum: y });
		}
	}
	return rows.map((row) => row.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));
}

export function matchLabel(label: string): { key: StatKey; kind: string } | null {
	const normalized = normalizeLabel(label);
	if (normalized.length < MIN_LABEL_LENGTH) return null;

	const scored = labelIndex
		.map((entry) => ({ entry, score: similarity(normalized, entry.normalized) }))
		.sort((a, b) => b.score - a.score);
	const [best, second] = scored;
	if (!best || best.score < MATCH_THRESHOLD) return null;
	if (second && best.score - second.score < MATCH_MARGIN) return null;
	return { key: best.entry.key, kind: best.entry.kind };
}

/** Parses "40 002", "17.571" or "1230" into 40002 etc. Returns `null` if the grouping is implausible. */
export function parseCount(tokens: string[]): number | null {
	const groups = tokens.flatMap((token) => token.split(/[.,]/)).filter((g) => g !== '');
	if (groups.length === 0 || groups.some((g) => !/^\d+$/.test(g))) return null;

	// A lone token such as "230523" has no separators and may be any length.
	if (groups.length > 1) {
		if (groups[0].length > 3) return null;
		if (groups.slice(1).some((g) => g.length !== 3)) return null;
	}
	const value = Number(groups.join(''));
	return Number.isSafeInteger(value) ? value : null;
}

export function parseDuration(text: string): number | null {
	const match = /^(\d+):([0-5]\d):([0-5]\d)$/.exec(text);
	if (!match) return null;
	return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function splitLabelAndValue(row: OcrWord[]): { label: OcrWord[]; value: OcrWord[] } {
	let start = row.length;
	while (start > 0 && isNumericToken(row[start - 1].text)) start--;
	return { label: row.slice(0, start), value: row.slice(start) };
}

function lowestConfidence(words: OcrWord[]): number {
	return Math.min(...words.map((w) => w.confidence));
}

export interface ParseContext {
	/** Width of the recognized image. Values touching its right edge may be cut off and are ignored. */
	imageWidth?: number;
}

/** A value this close to the image edge (in pixels) is treated as possibly truncated. */
const EDGE_MARGIN = 3;

export function parseStatsList(words: OcrWord[], context: ParseContext = {}): ParsedPass {
	const observations: RawObservation[] = [];
	const unmatchedLabels: string[] = [];
	let matchedRows = 0;

	for (const row of groupRows(words)) {
		const { label, value } = splitLabelAndValue(row);
		const labelText = label.map((w) => w.text).join(' ');
		if (value.length === 0 || normalizeLabel(labelText).length < MIN_LABEL_LENGTH) continue;

		const match = matchLabel(labelText);
		if (!match) {
			unmatchedLabels.push(labelText);
			continue;
		}
		matchedRows++;

		const touchesEdge =
			context.imageWidth !== undefined &&
			Math.max(...value.map((w) => w.bbox.x1)) >= context.imageWidth - EDGE_MARGIN;
		if (touchesEdge) continue;

		const tokens = value.map((w) => w.text);
		const parsed = match.kind === 'duration' ? parseDuration(tokens.join('')) : parseCount(tokens);
		if (parsed === null) continue;
		observations.push({ key: match.key, value: parsed, confidence: lowestConfidence(value) });
	}
	return { observations, names: [], matchedRows, unmatchedLabels };
}

const NAME_TOKEN = /^[\p{L}\p{N}_\-.]{2,}$/u;

export function parseHeader(words: OcrWord[]): ParsedPass {
	const observations: RawObservation[] = [];
	const names: RawNameObservation[] = [];
	const rows = groupRows(words);

	const levelRowIndex = rows.findIndex((row) =>
		row.some((w) => similarity(normalizeLabel(w.text), 'уровень') >= 0.75)
	);

	if (levelRowIndex >= 0) {
		const row = rows[levelRowIndex];
		const labelIndexInRow = row.findIndex(
			(w) => similarity(normalizeLabel(w.text), 'уровень') >= 0.75
		);
		const levelWord = row.slice(labelIndexInRow + 1).find((w) => /^\d{1,3}$/.test(w.text));
		if (levelWord) {
			observations.push({
				key: 'level',
				value: Number(levelWord.text),
				confidence: levelWord.confidence
			});
		}
	}

	// The name sits on the row directly above the level row (or the first row if there is none).
	const nameRow = levelRowIndex > 0 ? rows[levelRowIndex - 1] : levelRowIndex < 0 ? rows[0] : null;
	const candidates = (nameRow ?? []).filter(
		(w) => NAME_TOKEN.test(w.text) && !/^\d+$/.test(w.text)
	);
	const best = candidates.sort(
		(a, b) => b.text.length * b.confidence - a.text.length * a.confidence
	)[0];
	if (best) names.push({ text: best.text, confidence: best.confidence });

	return { observations, names, matchedRows: observations.length, unmatchedLabels: [] };
}
