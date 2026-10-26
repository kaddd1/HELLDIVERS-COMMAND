import { asset } from '$app/paths';
import type { OcrEngine } from './analyze.ts';
import { wordsFromBlocks } from './ocrWords.ts';
import type { RawImage } from './preprocess.ts';

export interface BrowserOcrEngine extends OcrEngine {
	terminate(): Promise<void>;
}

function toCanvas(image: RawImage): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = image.width;
	canvas.height = image.height;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas is not available');
	const pixels = new Uint8ClampedArray(image.data);
	context.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
	return canvas;
}

/**
 * Starts a Tesseract.js worker in the browser. The worker, WebAssembly core and language data
 * are served from `/ocr` (copied from node_modules by `scripts/copy-ocr-assets.mjs`),
 * so nothing is downloaded from third-party servers and screenshots never leave the device.
 */
export async function createBrowserEngine(): Promise<BrowserOcrEngine> {
	const { createWorker } = await import('tesseract.js');
	// `asset()` only accepts files, so directories are derived from the worker file.
	const workerUrl = new URL(asset('ocr/worker.min.js'), location.href);

	const worker = await createWorker(['rus', 'eng'], 1, {
		workerPath: workerUrl.href,
		corePath: new URL('core', workerUrl).href,
		langPath: new URL('lang', workerUrl).href,
		cacheMethod: 'none'
	});
	await worker.setParameters({
		tessedit_pageseg_mode: '6' as never,
		preserve_interword_spaces: '1'
	});

	return {
		async recognize(image) {
			const { data } = await worker.recognize(toCanvas(image), {}, { blocks: true });
			return wordsFromBlocks(data.blocks);
		},
		terminate: async () => {
			await worker.terminate();
		}
	};
}
