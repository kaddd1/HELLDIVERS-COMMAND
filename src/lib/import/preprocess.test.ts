import { describe, expect, it } from 'vitest';
import { FULL_FRAME, otsuThreshold, preprocess, type RawImage } from './preprocess.ts';

/** A dark image with a light rectangle, like game text on a dark panel. */
function makeImage(width: number, height: number): RawImage {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const light = x >= width / 2 && y >= height / 2;
			const v = light ? 230 : 30;
			const i = (y * width + x) * 4;
			data[i] = data[i + 1] = data[i + 2] = v;
			data[i + 3] = 255;
		}
	}
	return { width, height, data };
}

describe('otsuThreshold', () => {
	it('separates dark and light pixels', () => {
		const gray = new Float32Array([...Array(50).fill(30), ...Array(50).fill(230)]);
		const threshold = otsuThreshold(gray);
		expect(threshold).toBeGreaterThanOrEqual(30);
		expect(threshold).toBeLessThan(230);
	});
});

describe('preprocess', () => {
	it('crops a region and normalizes size to a 1080p reference', () => {
		const image = makeImage(1920, 1080);
		const out = preprocess(image, { x0: 0, y0: 0, x1: 0.5, y1: 0.5 }, 'binary');
		expect(out.width).toBe(960);
		expect(out.height).toBe(540);
	});

	it('scales screenshots of other resolutions to the same text size', () => {
		const out = preprocess(makeImage(960, 540), FULL_FRAME, 'binary');
		expect(out.height).toBe(1080);
	});

	it('produces dark text on a light background when binarizing', () => {
		const out = preprocess(makeImage(200, 100), FULL_FRAME, 'binary');
		const at = (x: number, y: number) => out.data[(y * out.width + x) * 4];
		expect(at(5, 5)).toBe(255); // dark panel becomes white
		expect(at(out.width - 5, out.height - 5)).toBe(0); // light text becomes black
	});

	it('uses a different size for the alternate pass', () => {
		const image = makeImage(1920, 1080);
		const a = preprocess(image, FULL_FRAME, 'binary');
		const b = preprocess(image, FULL_FRAME, 'binary-alt');
		expect(b.width).toBeGreaterThan(a.width);
	});

	it('fully opaque output', () => {
		const out = preprocess(makeImage(50, 50), FULL_FRAME, 'overview');
		for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(255);
	});
});
