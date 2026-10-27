export type Faction = 'humans' | 'terminids' | 'automatons' | 'illuminate';
export type TaskKind = 'eradicate' | 'liberate' | 'defend' | 'control' | 'unknown';

export interface TaskCounter {
	current: number;
	goal: number;
}

export interface OrderTask {
	/** Numeric task type exactly as the API reports it. */
	type: number;
	kind: TaskKind;
	/** `'any'` when the task is not limited to one faction; `null` when not applicable or unknown. */
	faction: Faction | 'any' | null;
	/** Set only for task types whose progress is verified against live data. */
	counter: TaskCounter | null;
}

export interface OrderReward {
	type: number;
	amount: number;
}

export interface MajorOrder {
	id: number;
	title: string | null;
	briefing: string | null;
	description: string | null;
	/** ISO 8601, or `null` when the API gave no valid expiration. */
	expiresAt: string | null;
	tasks: OrderTask[];
	rewards: OrderReward[];
}

export type OrderState = 'active' | 'completed' | 'expired';

/** Task type codes seen in community tooling; the API itself does not document them. */
const KINDS: Record<number, TaskKind> = {
	3: 'eradicate',
	11: 'liberate',
	12: 'defend',
	13: 'control'
};
const FACTIONS: Record<number, Faction> = {
	1: 'humans',
	2: 'terminids',
	3: 'automatons',
	4: 'illuminate'
};

/** Positions in `valueTypes` that identify a value's meaning. */
const VALUE_TYPE_FACTION = 1;
const VALUE_TYPE_GOAL = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	return text === '' ? null : text;
}

function toIso(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberList(value: unknown): number[] | null {
	if (!Array.isArray(value)) return null;
	const list = value.map(toNumber);
	return list.every((n): n is number => n !== null) ? list : null;
}

function valueOfType(task: Record<string, unknown>, valueType: number): number | null {
	const values = numberList(task.values);
	const types = numberList(task.valueTypes);
	if (!values || !types) return null;
	const index = types.indexOf(valueType);
	return index >= 0 && index < values.length ? values[index] : null;
}

function parseTask(raw: unknown, progress: number | null): OrderTask | null {
	if (!isRecord(raw)) return null;
	const type = toNumber(raw.type);
	if (type === null) return null;

	const kind = KINDS[type] ?? 'unknown';
	// Only the eradication counter is confirmed: its progress reaches the goal exactly.
	// Other task types keep their meaning of `progress` unverified, so no counter is shown.
	let counter: TaskCounter | null = null;
	let faction: OrderTask['faction'] = null;
	if (kind === 'eradicate') {
		const goal = valueOfType(raw, VALUE_TYPE_GOAL);
		if (goal !== null && goal > 0 && progress !== null && progress >= 0) {
			counter = { current: progress, goal };
		}
		const race = valueOfType(raw, VALUE_TYPE_FACTION);
		faction = race === null ? null : race === 0 ? 'any' : (FACTIONS[race] ?? null);
	}
	return { type, kind, faction, counter };
}

function parseOrder(raw: unknown): MajorOrder | null {
	if (!isRecord(raw)) return null;
	const id = toNumber(raw.id);
	if (id === null) return null;

	const progress = Array.isArray(raw.progress) ? raw.progress : [];
	const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
	// Progress is matched to tasks by position; a length mismatch means it cannot be trusted.
	const aligned = progress.length === rawTasks.length;
	const tasks = rawTasks
		.map((task, index) => parseTask(task, aligned ? toNumber(progress[index]) : null))
		.filter((task): task is OrderTask => task !== null);

	const rewardsSource = Array.isArray(raw.rewards)
		? raw.rewards
		: raw.reward !== undefined
			? [raw.reward]
			: [];
	const rewards = rewardsSource.flatMap((reward): OrderReward[] => {
		if (!isRecord(reward)) return [];
		const type = toNumber(reward.type);
		const amount = toNumber(reward.amount);
		return type !== null && amount !== null && amount > 0 ? [{ type, amount }] : [];
	});

	return {
		id,
		title: toText(raw.title),
		briefing: toText(raw.briefing),
		description: toText(raw.description),
		expiresAt: toIso(raw.expiration),
		tasks,
		rewards
	};
}

/** Converts the API's assignment list into display data; malformed entries are dropped. */
export function normalizeAssignments(raw: unknown): MajorOrder[] {
	if (!Array.isArray(raw)) return [];
	return raw.map(parseOrder).filter((order): order is MajorOrder => order !== null);
}

export function orderState(order: MajorOrder, nowMs: number): OrderState {
	if (order.expiresAt !== null && nowMs >= new Date(order.expiresAt).getTime()) return 'expired';
	const allMeasured = order.tasks.length > 0 && order.tasks.every((task) => task.counter !== null);
	if (allMeasured && order.tasks.every((task) => task.counter!.current >= task.counter!.goal)) {
		return 'completed';
	}
	return 'active';
}

/** Share of the goal reached, from 0 to 1. */
export function counterShare(counter: TaskCounter): number {
	return Math.min(1, counter.current / counter.goal);
}

export interface Remaining {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	totalMs: number;
}

/** Splits the time until `expiresAt`; `null` when there is no expiration. Never negative. */
export function remainingTime(expiresAt: string | null, nowMs: number): Remaining | null {
	if (expiresAt === null) return null;
	const totalMs = Math.max(0, new Date(expiresAt).getTime() - nowMs);
	const total = Math.floor(totalMs / 1000);
	return {
		days: Math.floor(total / 86400),
		hours: Math.floor((total % 86400) / 3600),
		minutes: Math.floor((total % 3600) / 60),
		seconds: total % 60,
		totalMs
	};
}

export interface ProgressChange {
	orderId: number;
	taskIndex: number;
	faction: OrderTask['faction'];
	kind: TaskKind;
	/** Difference of the task counter; negative if the API reports a lower value than before. */
	delta: number;
}

export interface OrderChanges {
	progress: ProgressChange[];
	/** Orders, goals, rewards or texts differ, not just the counters. */
	structural: boolean;
}

/** Compares two lists of orders. The expiration is ignored: the API recomputes it on every request. */
export function describeChanges(previous: MajorOrder[], next: MajorOrder[]): OrderChanges {
	const progress: ProgressChange[] = [];
	let structural = previous.length !== next.length;

	for (const order of next) {
		const before = previous.find((o) => o.id === order.id);
		if (!before) {
			structural = true;
			continue;
		}
		if (
			before.title !== order.title ||
			before.briefing !== order.briefing ||
			before.description !== order.description ||
			before.tasks.length !== order.tasks.length ||
			JSON.stringify(before.rewards) !== JSON.stringify(order.rewards)
		) {
			structural = true;
		}
		order.tasks.forEach((task, taskIndex) => {
			const old = before.tasks[taskIndex];
			if (!old || !task.counter || !old.counter) return;
			if (task.counter.goal !== old.counter.goal || task.type !== old.type) structural = true;
			else if (task.counter.current !== old.counter.current) {
				progress.push({
					orderId: order.id,
					taskIndex,
					faction: task.faction,
					kind: task.kind,
					delta: task.counter.current - old.counter.current
				});
			}
		});
	}
	return { progress, structural };
}
