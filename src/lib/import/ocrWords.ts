import type { BBox, OcrWord } from './types.ts';

export interface BlockLike {
	paragraphs: {
		lines: { words: { text: string; confidence: number; bbox: BBox }[] }[];
	}[];
}

export function wordsFromBlocks(blocks: BlockLike[] | null | undefined): OcrWord[] {
	const words: OcrWord[] = [];
	for (const block of blocks ?? []) {
		for (const paragraph of block.paragraphs) {
			for (const line of paragraph.lines) {
				for (const word of line.words) {
					words.push({ text: word.text, confidence: word.confidence, bbox: word.bbox });
				}
			}
		}
	}
	return words;
}
