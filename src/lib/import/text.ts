/** Lowercases, folds "ё", and strips punctuation so OCR noise does not affect label matching. */
export function normalizeLabel(text: string): string {
	return text
		.toLowerCase()
		.replaceAll('ё', 'е')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function levenshtein(a: string, b: string): number {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
		}
		previous = current;
	}
	return previous[b.length];
}

export function similarity(a: string, b: string): number {
	const longest = Math.max(a.length, b.length);
	return longest === 0 ? 1 : 1 - levenshtein(a, b) / longest;
}
