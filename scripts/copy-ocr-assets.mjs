// Copies the OCR worker, WebAssembly core and language data into static/ocr so the importer
// runs fully offline and never fetches code or models from a third-party CDN.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'static', 'ocr');

const core = 'node_modules/tesseract.js-core';
const files = [
	['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
	[`${core}/tesseract-core-lstm.wasm.js`, 'core/tesseract-core-lstm.wasm.js'],
	[`${core}/tesseract-core-simd-lstm.wasm.js`, 'core/tesseract-core-simd-lstm.wasm.js'],
	[
		`${core}/tesseract-core-relaxedsimd-lstm.wasm.js`,
		'core/tesseract-core-relaxedsimd-lstm.wasm.js'
	],
	[
		'node_modules/@tesseract.js-data/rus/4.0.0_best_int/rus.traineddata.gz',
		'lang/rus.traineddata.gz'
	],
	[
		'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
		'lang/eng.traineddata.gz'
	]
];

for (const [from, to] of files) {
	const source = join(root, from);
	const destination = join(target, to);
	if (!existsSync(source)) {
		console.warn(`OCR asset missing, run "npm install": ${from}`);
		continue;
	}
	if (existsSync(destination) && statSync(destination).size === statSync(source).size) continue;
	mkdirSync(dirname(destination), { recursive: true });
	copyFileSync(source, destination);
}
