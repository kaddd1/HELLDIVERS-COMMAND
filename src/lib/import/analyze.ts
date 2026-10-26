import { locateLayout } from './locate.ts';
import { parseHeader, parseStatsList } from './parse.ts';
import {
	FULL_FRAME,
	preprocess,
	type PreprocessMode,
	type RawImage,
	type Region
} from './preprocess.ts';
import type { OcrWord, ParsedPass, ScreenshotAnalysis } from './types.ts';

export interface OcrEngine {
	recognize(image: RawImage): Promise<OcrWord[]>;
}

/**
 * Stats list and header positions on a standard 16:9 career screen. Used only when the layout
 * cannot be located on the screenshot itself.
 */
export const DEFAULT_PANEL_REGION: Region = { x0: 0.1, y0: 0.2, x1: 0.37, y1: 0.93 };
export const DEFAULT_HEADER_REGION: Region = { x0: 0.38, y0: 0.15, x1: 0.6, y1: 0.22 };

const MIN_ROWS = 3;

/** Locate pass + two passes over the stats list + two passes over the header. */
export const PASSES_PER_SCREENSHOT = 5;

export interface AnalyzeCallbacks {
	onStep?: (done: number, total: number) => void;
}

export async function analyzeScreenshot(
	image: RawImage,
	screenshot: number,
	engine: OcrEngine,
	callbacks: AnalyzeCallbacks = {}
): Promise<ScreenshotAnalysis> {
	const analysis: ScreenshotAnalysis = {
		observations: [],
		names: [],
		matchedRows: 0,
		unmatchedLabels: []
	};
	let done = 0;
	const step = (): void => {
		done++;
		callbacks.onStep?.(done, PASSES_PER_SCREENSHOT);
	};

	// Pass 1: coarse look at the whole frame, used only to find where things are.
	const overview = preprocess(image, FULL_FRAME, 'overview');
	const layout = locateLayout(await engine.recognize(overview), overview.width, overview.height);
	step();

	const read = async (
		id: string,
		region: Region,
		mode: PreprocessMode,
		parse: (words: OcrWord[], context: { imageWidth: number }) => ParsedPass
	): Promise<ParsedPass> => {
		const prepared = preprocess(image, region, mode);
		const parsed = parse(await engine.recognize(prepared), { imageWidth: prepared.width });
		for (const o of parsed.observations) {
			analysis.observations.push({ ...o, screenshot, pass: id });
		}
		for (const n of parsed.names) analysis.names.push({ ...n, screenshot, pass: id });
		step();
		return parsed;
	};

	const panel = layout.panel ?? DEFAULT_PANEL_REGION;
	for (const mode of ['binary', 'binary-alt'] as const) {
		const parsed = await read(`panel-${mode}`, panel, mode, parseStatsList);
		analysis.matchedRows = Math.max(analysis.matchedRows, parsed.matchedRows);
		analysis.unmatchedLabels.push(...parsed.unmatchedLabels);
	}

	if (analysis.matchedRows >= MIN_ROWS) {
		const header = layout.header ?? DEFAULT_HEADER_REGION;
		for (const mode of ['binary', 'binary-alt'] as const) {
			await read(`header-${mode}`, header, mode, parseHeader);
		}
	} else {
		step();
		step();
	}
	return analysis;
}
