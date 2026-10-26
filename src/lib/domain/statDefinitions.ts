/**
 * Career statistics shown on the Helldivers 2 "Карьера" screen (Russian client).
 * The list is in the order the game displays the rows.
 */

export type StatGroup = 'profile' | 'kills' | 'combat' | 'stratagems' | 'missions';
export type StatKind = 'count' | 'duration';

export interface StatDefinition {
	key: StatKey;
	label: string;
	group: StatGroup;
	kind: StatKind;
	required: boolean;
}

export const STAT_DEFINITIONS = [
	{ key: 'level', label: 'Уровень', group: 'profile', kind: 'count', required: true },
	{ key: 'kills', label: 'Убито врагов', group: 'kills', kind: 'count', required: true },
	{ key: 'killsBugs', label: 'Убито жуков', group: 'kills', kind: 'count', required: false },
	{
		key: 'killsAutomatons',
		label: 'Убито автоматонов',
		group: 'kills',
		kind: 'count',
		required: false
	},
	{
		key: 'killsIlluminate',
		label: 'Убито просветленных',
		group: 'kills',
		kind: 'count',
		required: false
	},
	{ key: 'friendlyKills', label: 'Убито своих', group: 'kills', kind: 'count', required: false },
	{ key: 'grenadeKills', label: 'Убито гранатами', group: 'kills', kind: 'count', required: false },
	{
		key: 'meleeKills',
		label: 'Убито в ближнем бою',
		group: 'kills',
		kind: 'count',
		required: false
	},
	{ key: 'eagleKills', label: 'Убито «Орлом»', group: 'kills', kind: 'count', required: false },
	{ key: 'deaths', label: 'Смертей', group: 'combat', kind: 'count', required: true },
	{
		key: 'shotsFired',
		label: 'Сделано выстрелов',
		group: 'combat',
		kind: 'count',
		required: false
	},
	{ key: 'shotsHit', label: 'Попаданий', group: 'combat', kind: 'count', required: false },
	{
		key: 'orbitalStratagems',
		label: 'Прим. орбитальной поддержки',
		group: 'stratagems',
		kind: 'count',
		required: false
	},
	{
		key: 'defensiveStratagems',
		label: 'Прим. защитных стратагем',
		group: 'stratagems',
		kind: 'count',
		required: false
	},
	{
		key: 'eagleStratagems',
		label: 'Прим. стратагем «Орла»',
		group: 'stratagems',
		kind: 'count',
		required: false
	},
	{
		key: 'supplyStratagems',
		label: 'Прим. стратагем снабжения',
		group: 'stratagems',
		kind: 'count',
		required: false
	},
	{
		key: 'reinforcementStratagems',
		label: 'Прим. стратагем подкрепления',
		group: 'stratagems',
		kind: 'count',
		required: false
	},
	{
		key: 'stratagemsUsed',
		label: 'Применено стратагем',
		group: 'stratagems',
		kind: 'count',
		required: false
	},
	{
		key: 'successfulExtractions',
		label: 'Успешных эвакуаций',
		group: 'missions',
		kind: 'count',
		required: false
	},
	{
		key: 'objectivesCompleted',
		label: 'Достигнуто целей',
		group: 'missions',
		kind: 'count',
		required: false
	},
	{
		key: 'missionsPlayed',
		label: 'Сыграно заданий',
		group: 'missions',
		kind: 'count',
		required: true
	},
	{
		key: 'missionsCompleted',
		label: 'Выполнено заданий',
		group: 'missions',
		kind: 'count',
		required: true
	},
	{
		key: 'timeInMissions',
		label: 'Время в заданиях',
		group: 'missions',
		kind: 'duration',
		required: false
	},
	{
		key: 'samplesCollected',
		label: 'Собрано образцов',
		group: 'missions',
		kind: 'count',
		required: false
	},
	{
		key: 'totalXp',
		label: 'Всего получено опыта',
		group: 'missions',
		kind: 'count',
		required: false
	}
] as const satisfies readonly {
	key: string;
	label: string;
	group: StatGroup;
	kind: StatKind;
	required: boolean;
}[];

export type StatKey = (typeof STAT_DEFINITIONS)[number]['key'];

export type StatValues = Partial<Record<StatKey, number>>;

export type CoreStatKey =
	| 'level'
	| 'kills'
	| 'deaths'
	| 'missionsPlayed'
	| 'missionsCompleted'
	| 'shotsFired'
	| 'shotsHit'
	| 'timeInMissions';

export type ExtraStatKey = Exclude<StatKey, CoreStatKey>;

export const STAT_KEYS: readonly StatKey[] = STAT_DEFINITIONS.map((d) => d.key);

export const REQUIRED_STAT_KEYS: readonly StatKey[] = STAT_DEFINITIONS.filter(
	(d) => d.required
).map((d) => d.key);

const byKey = new Map<StatKey, StatDefinition>(STAT_DEFINITIONS.map((d) => [d.key, d]));

export function getDefinition(key: StatKey): StatDefinition {
	return byKey.get(key) as StatDefinition;
}

export function isExtraStatKey(key: StatKey): key is ExtraStatKey {
	return !CORE_KEYS.has(key);
}

const CORE_KEYS = new Set<StatKey>([
	'level',
	'kills',
	'deaths',
	'missionsPlayed',
	'missionsCompleted',
	'shotsFired',
	'shotsHit',
	'timeInMissions'
]);
