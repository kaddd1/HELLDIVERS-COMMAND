export interface RawImage {
	width: number;
	height: number;
	data: Uint8ClampedArray;
}

export interface Region {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

/**
 * - `binary`: black text on white, thresholded at native size; the most accurate pass for digits.
 * - `binary-alt`: the same at a slightly different size, so recognition errors are not shared.
 * - `overview`: inverted grayscale at reduced size, used only to find where things are.
 */
export type PreprocessMode = 'binary' | 'binary-alt' | 'overview';

export const FULL_FRAME: Region = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** Screen text height the OCR passes were tuned for. */
const REFERENCE_HEIGHT = 1080;

function toGrayscale(
	image: RawImage,
	region: Region
): { gray: Float32Array; w: number; h: number } {
	const x0 = Math.max(0, Math.round(image.width * region.x0));
	const x1 = Math.min(image.width, Math.round(image.width * region.x1));
	const y0 = Math.max(0, Math.round(image.height * region.y0));
	const y1 = Math.min(image.height, Math.round(image.height * region.y1));
	const w = Math.max(1, x1 - x0);
	const h = Math.max(1, y1 - y0);

	const gray = new Float32Array(w * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = ((y + y0) * image.width + (x + x0)) * 4;
			gray[y * w + x] =
				0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
		}
	}
	return { gray, w, h };
}

function resample(
	gray: Float32Array,
	w: number,
	h: number,
	scale: number
): { gray: Float32Array; w: number; h: number } {
	if (scale === 1) return { gray, w, h };
	const ow = Math.max(1, Math.round(w * scale));
	const oh = Math.max(1, Math.round(h * scale));
	const out = new Float32Array(ow * oh);

	for (let y = 0; y < oh; y++) {
		const sy = Math.min(h - 1, y / scale);
		const y0 = Math.floor(sy);
		const y1 = Math.min(h - 1, y0 + 1);
		const fy = sy - y0;
		for (let x = 0; x < ow; x++) {
			const sx = Math.min(w - 1, x / scale);
			const x0 = Math.floor(sx);
			const x1 = Math.min(w - 1, x0 + 1);
			const fx = sx - x0;
			out[y * ow + x] =
				gray[y0 * w + x0] * (1 - fx) * (1 - fy) +
				gray[y0 * w + x1] * fx * (1 - fy) +
				gray[y1 * w + x0] * (1 - fx) * fy +
				gray[y1 * w + x1] * fx * fy;
		}
	}
	return { gray: out, w: ow, h: oh };
}

/** Otsu's method: the threshold that best separates dark and light pixels. */
export function otsuThreshold(gray: Float32Array): number {
	const histogram = new Array<number>(256).fill(0);
	for (const value of gray) histogram[Math.min(255, Math.max(0, Math.round(value)))]++;

	const total = gray.length;
	let sumAll = 0;
	for (let i = 0; i < 256; i++) sumAll += i * histogram[i];

	let weightBackground = 0;
	let sumBackground = 0;
	let bestVariance = -1;
	let best = 128;
	for (let t = 0; t < 256; t++) {
		weightBackground += histogram[t];
		if (weightBackground === 0) continue;
		const weightForeground = total - weightBackground;
		if (weightForeground === 0) break;
		sumBackground += t * histogram[t];
		const meanBackground = sumBackground / weightBackground;
		const meanForeground = (sumAll - sumBackground) / weightForeground;
		const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
		if (variance > bestVariance) {
			bestVariance = variance;
			best = t;
		}
	}
	return best;
}

export interface RenderOptions {
	scale: number;
	binarize: boolean;
}

export const RENDER_OPTIONS: Record<PreprocessMode, RenderOptions> = {
	binary: { scale: 1, binarize: true },
	'binary-alt': { scale: 1.1, binarize: true },
	overview: { scale: 0.75, binarize: false }
};

/**
 * Crops `region`, normalizes the size relative to a 1080p screen, and converts light-on-dark
 * game text to dark-on-light for Tesseract.
 */
export function renderRegion(image: RawImage, region: Region, options: RenderOptions): RawImage {
	const cropped = toGrayscale(image, region);
	const scale = (REFERENCE_HEIGHT / image.height) * options.scale;
	const { gray, w, h } = resample(cropped.gray, cropped.w, cropped.h, scale);

	const threshold = options.binarize ? otsuThreshold(gray) : 0;
	const data = new Uint8ClampedArray(w * h * 4);
	for (let i = 0; i < gray.length; i++) {
		const value = options.binarize ? (gray[i] > threshold ? 0 : 255) : 255 - gray[i];
		data[i * 4] = value;
		data[i * 4 + 1] = value;
		data[i * 4 + 2] = value;
		data[i * 4 + 3] = 255;
	}
	return { width: w, height: h, data };
}

export function preprocess(image: RawImage, region: Region, mode: PreprocessMode): RawImage {
	return renderRegion(image, region, RENDER_OPTIONS[mode]);
}
