import type { StatValues } from '../domain/statDefinitions.ts';
import { buildCompositions, MIN_MISSIONS, type Composition } from './profile.ts';

/**
 * Career portrait: what the latest snapshot says about the whole career. Everything here is an
 * average or a share over all missions, never a single-mission figure, and nothing is rated
 * against other players.
 */

function divide(a: number | undefined, b: number | undefined): number | null {
	if (a === undefined || b === undefined || b <= 0) return null;
	return a / b;
}

export interface Portrait {
	missions: number;
	/** Enough missions for the averages to mean something. */
	reliable: boolean;
	/** Natural 0..1 shares. */
	accuracy: number | null;
	success: number | null;
	extraction: number | null;
	kd: number | null;
	killsPerMission: number | null;
	deathsPerMission: number | null;
	killsPerMinute: number | null;
	minutesPerMission: number | null;
	compositions: Composition[];
	facts: Fact[];
}

export type Fact =
	| { kind: 'killsPerDeath'; value: number }
	| { kind: 'hitsPer100'; value: number }
	| { kind: 'missionLength'; minutes: number; killsPerMinute: number | null }
	| { kind: 'failedMissions'; oneIn: number; failed: number }
	| { kind: 'allMissionsCompleted' }
	| { kind: 'favoriteFaction'; part: string; share: number; even: boolean }
	| { kind: 'methodShare'; part: string; oneIn: number }
	| { kind: 'friendlyFire'; oneIn: number; count: number }
	| { kind: 'noFriendlyFire' }
	| { kind: 'stratagems'; perMission: number; favorite: string | null; share: number | null }
	| { kind: 'objectives'; perMission: number }
	| { kind: 'samples'; perMission: number };

/** Factions are "even" when the top two shares are closer than this. */
const EVEN_SPREAD = 0.08;
/** A kill method must account for at least this share to be mentioned. */
const MIN_METHOD_SHARE = 0.01;

function topPart(composition: Composition | undefined, skip: string[] = []) {
	if (!composition) return null;
	const parts = composition.parts.filter((p) => !skip.includes(p.id));
	return parts.length === 0 ? null : parts.reduce((a, b) => (b.share > a.share ? b : a));
}

export function buildPortrait(values: StatValues): Portrait {
	const missions = values.missionsPlayed ?? 0;
	const hours = values.timeInMissions === undefined ? null : values.timeInMissions / 3600;
	const minutesPerMission = hours === null ? null : divide(hours * 60, values.missionsPlayed);
	const killsPerMinute = hours === null ? null : divide(values.kills, hours * 60);
	const extractionRaw = divide(values.successfulExtractions, values.missionsPlayed);

	const compositions = buildCompositions(values);
	const get = (id: Composition['id']) => compositions.find((c) => c.id === id);

	const portrait: Portrait = {
		missions,
		reliable: missions >= MIN_MISSIONS,
		accuracy: divide(values.shotsHit, values.shotsFired),
		success: divide(values.missionsCompleted, values.missionsPlayed),
		// More evacuations than missions would be nonsense; do not draw it as a share.
		extraction: extractionRaw !== null && extractionRaw <= 1 ? extractionRaw : null,
		kd: divide(values.kills, values.deaths),
		killsPerMission: divide(values.kills, values.missionsPlayed),
		deathsPerMission: divide(values.deaths, values.missionsPlayed),
		killsPerMinute,
		minutesPerMission,
		compositions,
		facts: []
	};

	const facts: Fact[] = [];

	const factions = get('factions');
	const top = topPart(factions);
	if (factions && top) {
		const second = factions.parts
			.filter((p) => p.id !== top.id)
			.reduce((a, b) => (b.share > a.share ? b : a));
		facts.push({
			kind: 'favoriteFaction',
			part: top.id,
			share: top.share,
			even: top.share - second.share < EVEN_SPREAD
		});
	}

	const method = topPart(get('methods'), ['other']);
	if (method && method.share >= MIN_METHOD_SHARE) {
		facts.push({ kind: 'methodShare', part: method.id, oneIn: Math.round(1 / method.share) });
	}

	if (portrait.kd !== null) facts.push({ kind: 'killsPerDeath', value: portrait.kd });
	if (portrait.accuracy !== null) {
		facts.push({ kind: 'hitsPer100', value: Math.round(portrait.accuracy * 100) });
	}

	if (minutesPerMission !== null) {
		facts.push({ kind: 'missionLength', minutes: minutesPerMission, killsPerMinute });
	}

	if (values.missionsPlayed !== undefined && values.missionsCompleted !== undefined) {
		const failed = values.missionsPlayed - values.missionsCompleted;
		if (failed > 0) {
			facts.push({
				kind: 'failedMissions',
				oneIn: Math.round(values.missionsPlayed / failed),
				failed
			});
		} else if (values.missionsPlayed > 0) {
			facts.push({ kind: 'allMissionsCompleted' });
		}
	}

	const stratagemsPerMission = divide(values.stratagemsUsed, values.missionsPlayed);
	if (stratagemsPerMission !== null) {
		const favorite = topPart(get('stratagems'), ['other']);
		facts.push({
			kind: 'stratagems',
			perMission: stratagemsPerMission,
			favorite: favorite?.id ?? null,
			share: favorite?.share ?? null
		});
	}

	const objectives = divide(values.objectivesCompleted, values.missionsPlayed);
	if (objectives !== null) facts.push({ kind: 'objectives', perMission: objectives });
	const samples = divide(values.samplesCollected, values.missionsPlayed);
	if (samples !== null) facts.push({ kind: 'samples', perMission: samples });

	if (values.friendlyKills !== undefined && values.kills !== undefined && values.kills > 0) {
		facts.push(
			values.friendlyKills > 0
				? {
						kind: 'friendlyFire',
						oneIn: Math.round(values.kills / values.friendlyKills),
						count: values.friendlyKills
					}
				: { kind: 'noFriendlyFire' }
		);
	}

	portrait.facts = facts;
	return portrait;
}
