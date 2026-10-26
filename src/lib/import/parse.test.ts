import { describe, expect, it } from 'vitest';
import { SCREEN_ONE, SCREEN_TWO, headerWords, rowsToWords, shuffled } from './fixtures.ts';
import {
	groupRows,
	matchLabel,
	parseCount,
	parseDuration,
	parseHeader,
	parseStatsList
} from './parse.ts';
import type { OcrWord } from './types.ts';

function valuesOf(words: OcrWord[]): Record<string, number> {
	return Object.fromEntries(parseStatsList(words).observations.map((o) => [o.key, o.value]));
}

describe('parseCount', () => {
	it('joins thousands groups split by spaces', () => {
		expect(parseCount(['40', '002'])).toBe(40002);
		expect(parseCount(['230', '523'])).toBe(230523);
		expect(parseCount(['1', '231', '000'])).toBe(1231000);
	});

	it('accepts a single token with or without a separator', () => {
		expect(parseCount(['1230'])).toBe(1230);
		expect(parseCount(['17.571'])).toBe(17571);
		expect(parseCount(['230523'])).toBe(230523);
	});

	it('rejects implausible grouping instead of guessing', () => {
		expect(parseCount(['40', '00'])).toBeNull();
		expect(parseCount(['4000', '002'])).toBeNull();
		expect(parseCount(['40', '002', '5'])).toBeNull();
		expect(parseCount([])).toBeNull();
	});
});

describe('parseDuration', () => {
	it('converts h:mm:ss to seconds', () => {
		expect(parseDuration('95:54:28')).toBe(345268);
		expect(parseDuration('0:05:00')).toBe(300);
	});

	it('rejects malformed times', () => {
		expect(parseDuration('95:54')).toBeNull();
		expect(parseDuration('95:75:28')).toBeNull();
		expect(parseDuration('abc')).toBeNull();
	});
});

describe('matchLabel', () => {
	it('matches every label printed by the game', () => {
		for (const row of [...SCREEN_ONE, ...SCREEN_TWO]) {
			expect(matchLabel(row.label), row.label).not.toBeNull();
		}
	});

	it('tolerates small OCR errors', () => {
		expect(matchLabel('Убито жуков.')?.key).toBe('killsBugs');
		expect(matchLabel('Убито автоматонав')?.key).toBe('killsAutomatons');
		expect(matchLabel('Выполнено заданий')?.key).toBe('missionsCompleted');
		expect(matchLabel('Выполнено заданий')?.key).not.toBe('missionsPlayed');
	});

	it('keeps similar labels apart', () => {
		expect(matchLabel('Прим. стратагем снабжения')?.key).toBe('supplyStratagems');
		expect(matchLabel('Прим. стратагем подкрепления')?.key).toBe('reinforcementStratagems');
		expect(matchLabel('Прим. стратагем «Орла»')?.key).toBe('eagleStratagems');
		expect(matchLabel('Сыграно заданий')?.key).toBe('missionsPlayed');
	});

	it('does not match unknown or empty labels', () => {
		expect(matchLabel('Собрано сокровищ и трофеев')).toBeNull();
		expect(matchLabel('| .')).toBeNull();
		expect(matchLabel('')).toBeNull();
	});
});

describe('groupRows', () => {
	it('groups words by vertical position and orders them left to right', () => {
		const rows = groupRows(shuffled(rowsToWords(SCREEN_ONE.slice(0, 3))));
		expect(rows).toHaveLength(3);
		expect(rows[0].map((w) => w.text)).toEqual(['Убито', 'врагов', '40', '002']);
	});

	it('tolerates slight vertical jitter between words of one row', () => {
		const words = rowsToWords([SCREEN_ONE[0]]).map((w, i) => ({
			...w,
			bbox: { ...w.bbox, y0: w.bbox.y0 + (i % 2) * 4, y1: w.bbox.y1 + (i % 2) * 4 }
		}));
		expect(groupRows(words)).toHaveLength(1);
	});
});

describe('parseStatsList', () => {
	it('reads every value on the first screen', () => {
		const values = valuesOf(rowsToWords(SCREEN_ONE));
		expect(values).toMatchObject({
			kills: 40002,
			killsBugs: 17571,
			killsAutomatons: 14083,
			killsIlluminate: 8348,
			friendlyKills: 94,
			grenadeKills: 1230,
			meleeKills: 83,
			eagleKills: 5852,
			deaths: 886,
			shotsFired: 230523,
			shotsHit: 137458,
			orbitalStratagems: 620,
			defensiveStratagems: 626,
			eagleStratagems: 1531
		});
	});

	it('reads every value on the second screen, including the time', () => {
		const values = valuesOf(rowsToWords(SCREEN_TWO));
		expect(values).toMatchObject({
			supplyStratagems: 893,
			reinforcementStratagems: 819,
			stratagemsUsed: 4799,
			successfulExtractions: 237,
			objectivesCompleted: 1392,
			missionsPlayed: 281,
			missionsCompleted: 262,
			timeInMissions: 345268,
			samplesCollected: 4075,
			totalXp: 394150
		});
	});

	it('does not depend on the order of the OCR output', () => {
		const ordered = parseStatsList(rowsToWords(SCREEN_ONE)).observations;
		const shuffledResult = parseStatsList(shuffled(rowsToWords(SCREEN_ONE))).observations;
		const byKey = (list: typeof ordered) => Object.fromEntries(list.map((o) => [o.key, o.value]));
		expect(byKey(shuffledResult)).toEqual(byKey(ordered));
	});

	it('pairs each label with the value on the same row even if rows are offset', () => {
		const values = valuesOf(rowsToWords(SCREEN_ONE, { left: 300, right: 900, top: 400 }));
		expect(values.deaths).toBe(886);
		expect(values.kills).toBe(40002);
	});

	it('uses the lowest word confidence as the value confidence', () => {
		const words = rowsToWords([{ label: 'Попаданий', value: '137 458' }]);
		words[words.length - 1].confidence = 41;
		const [observation] = parseStatsList(words).observations;
		expect(observation.confidence).toBe(41);
	});

	it('reports unknown labels instead of guessing', () => {
		const result = parseStatsList(
			rowsToWords([{ label: 'Собрано сокровищ и трофеев', value: '12' }])
		);
		expect(result.observations).toEqual([]);
		expect(result.unmatchedLabels).toEqual(['Собрано сокровищ и трофеев']);
	});

	it('skips a row whose number is implausibly grouped', () => {
		const result = parseStatsList(rowsToWords([{ label: 'Убито врагов', value: '40 00' }]));
		expect(result.matchedRows).toBe(1);
		expect(result.observations).toEqual([]);
	});

	it('ignores a value touching the image edge because it may be cut off', () => {
		const words = rowsToWords([{ label: 'Убито врагов', value: '40 002' }], { right: 500 });
		const edge = Math.max(...words.map((w) => w.bbox.x1));
		expect(parseStatsList(words, { imageWidth: edge + 1 }).observations).toEqual([]);
		expect(parseStatsList(words, { imageWidth: edge + 100 }).observations).toHaveLength(1);
	});

	it('does not read a row without a numeric value', () => {
		expect(
			parseStatsList(rowsToWords([{ label: 'Убито врагов', value: 'нет' }])).observations
		).toEqual([]);
	});
});

describe('parseHeader', () => {
	it('reads the player name and level', () => {
		const result = parseHeader(headerWords('Tester', 86));
		expect(result.observations).toEqual([{ key: 'level', value: 86, confidence: 94 }]);
		expect(result.names[0].text).toBe('Tester');
	});

	it('does not invent a level when it is not on screen', () => {
		const result = parseHeader(headerWords('Tester', 86).filter((w) => w.text !== '86'));
		expect(result.observations).toEqual([]);
	});
});
