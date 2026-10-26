import type { RawImage } from './preprocess.ts';

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

export function isAcceptedImage(file: File): boolean {
	return (ACCEPTED_TYPES as readonly string[]).includes(file.type) && file.size <= MAX_FILE_BYTES;
}

export async function readPixels(file: File): Promise<RawImage> {
	const bitmap = await createImageBitmap(file);
	try {
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		const context = canvas.getContext('2d', { willReadFrequently: true });
		if (!context) throw new Error('Canvas is not available');
		context.drawImage(bitmap, 0, 0);
		const { width, height, data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
		return { width, height, data };
	} finally {
		bitmap.close();
	}
}
