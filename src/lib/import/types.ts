import type { StatKey } from '../domain/statDefinitions.ts';

export interface BBox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export interface OcrWord {
	text: string;
	/** 0..100 */
	confidence: number;
	bbox: BBox;
}

export interface RawObservation {
	key: StatKey;
	value: number;
	/** 0..100, the lowest confidence among the words forming the value. */
	confidence: number;
}

export interface RawNameObservation {
	text: string;
	confidence: number;
}

export interface ParsedPass {
	observations: RawObservation[];
	names: RawNameObservation[];
	matchedRows: number;
	unmatchedLabels: string[];
}

export interface Observation extends RawObservation {
	screenshot: number;
	pass: string;
}

export interface NameObservation extends RawNameObservation {
	screenshot: number;
	pass: string;
}

export interface ScreenshotAnalysis {
	observations: Observation[];
	names: NameObservation[];
	matchedRows: number;
	unmatchedLabels: string[];
}

export type StatStatus =
	/** Read consistently, no action needed. */
	| 'ok'
	/** Read once with low confidence; needs the user's confirmation. */
	| 'uncertain'
	/** Passes or screenshots disagree; the user must choose. */
	| 'conflict'
	/** Not found in either screenshot. */
	| 'missing';

export interface Candidate {
	value: number;
	votes: number;
	confidence: number;
}

export interface MergedStat {
	key: StatKey;
	status: StatStatus;
	value: number | null;
	candidates: Candidate[];
	screenshots: number[];
}

export interface NameCandidate {
	text: string;
	votes: number;
	confidence: number;
}

export interface MergedImport {
	stats: MergedStat[];
	names: NameCandidate[];
	matchedRows: number[];
}

export type IssueSeverity = 'error' | 'warning';

export type IssueCode =
	| 'completedExceedsPlayed'
	| 'hitsExceedShots'
	| 'subKillsExceedKills'
	| 'factionKillsMismatch'
	| 'stratagemsExceedTotal'
	| 'levelOutOfRange'
	| 'screenshotAddedNothing'
	| 'tooFewRows'
	| 'datesDiffer'
	| 'invalidDate'
	| 'dateInFuture'
	| 'possibleReset'
	| 'nextSnapshotAnomaly';

export interface ValidationIssue {
	code: IssueCode;
	severity: IssueSeverity;
	keys: StatKey[];
	params: Record<string, string | number>;
}
