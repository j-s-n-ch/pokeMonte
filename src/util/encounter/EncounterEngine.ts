import type { SleepType } from "../../data/fields";
import fields from "../../data/fields";
import sleepStylesData from "../../data/sleepStyles.json";
import { getPokemonCount } from "../PokemonCount";
import { getRankForPower, getRankIndex } from "./RankConverter";

export interface SleepStyle {
	readonly pokemon: string;
	readonly style: number; // 1, 2, 3, 4, 5
	readonly dpr: number;
	readonly sleepType: SleepType;
	readonly unlockRank: string;
	readonly areas: number[];
	unlockRankIndex?: number;
	styleKey?: string;
	pokemonLower?: string;
}

export interface SimulationConfig {
	readonly fieldIndex: number;
	readonly sleepType: SleepType;
	readonly snorlaxPower: number;
	readonly sleepScore: number;
}

export interface RollStep {
	readonly rollIndex: number;
	readonly rolledStyle: SleepStyle;
	readonly dprConsumed: number;
	readonly remainingGauge: number;
	readonly isNoGaugeRoll: boolean;
	readonly ruleApplied: string; // Annotation text
}

export interface SimulationResult {
	readonly drowsyPower: number;
	readonly spawnCount: number;
	readonly rolls: RollStep[];
	readonly gaugeDepleted: boolean;
}

export interface IndexedStyles {
	[mapIndex: number]: {
		dozing: SleepStyle[];
		snoozing: SleepStyle[];
		slumbering: SleepStyle[];
	};
}

const styles = sleepStylesData as SleepStyle[];
let indexedStylesCache: IndexedStyles | null = null;

/**
 * Pre-groups flat sleep style list by field index and sleep type, sorted ascending by DPR.
 * Called once at module startup to optimize Monte Carlo lookups to O(1).
 */
export function preGroupSleepStyles(): IndexedStyles {
	if (indexedStylesCache) {
		return indexedStylesCache;
	}

	const cache: IndexedStyles = {};
	for (let f = 0; f < 8; f++) {
		cache[f] = {
			dozing: [],
			snoozing: [],
			slumbering: [],
		};
	}

	for (const rawStyle of styles) {
		const style: SleepStyle = {
			...rawStyle,
			unlockRankIndex: getRankIndex(rawStyle.unlockRank),
			styleKey: `${rawStyle.pokemon} ${rawStyle.style}⭐`,
			pokemonLower: rawStyle.pokemon.toLowerCase(),
		};
		for (const area of style.areas) {
			if (area >= 0 && area < 8) {
				const list = cache[area][style.sleepType];
				if (list) {
					list.push(style);
				}
			}
		}
	}

	// Sort each list by DPR ascending
	for (let f = 0; f < 8; f++) {
		cache[f].dozing.sort((a, b) => a.dpr - b.dpr);
		cache[f].snoozing.sort((a, b) => a.dpr - b.dpr);
		cache[f].slumbering.sort((a, b) => a.dpr - b.dpr);
	}

	indexedStylesCache = cache;
	return cache;
}

/**
 * Simulates a single night's sleep encounter rolls.
 * Follows sequential DPR gauge depletion, atop-belly caps, last roll rules, and depleted gauge v2.11.0+ rules.
 *
 * @param config Simulation parameters
 * @param precomputed Optional pre-filtered pools for high-performance Monte Carlo iterations
 * @returns Resulting rolls, spawn counts, and annotations
 */
export function simulateNightEncounter(
	config: SimulationConfig,
	precomputed?: {
		eligiblePool: SleepStyle[];
		noGaugePool: SleepStyle[];
		spawnCount: number;
	},
): SimulationResult {
	const index = preGroupSleepStyles();
	const mapIndex = config.fieldIndex;
	const sleepType = config.sleepType;

	const mapStyles = index[mapIndex];
	if (!mapStyles) {
		throw new Error(`Invalid map index: ${mapIndex}`);
	}

	const subPool = mapStyles[sleepType];
	if (!subPool) {
		throw new Error(`Invalid sleep type: ${sleepType}`);
	}

	const drowsyPower = config.snorlaxPower * config.sleepScore;
	let eligiblePool: SleepStyle[];
	let noGaugePool: SleepStyle[];
	let spawnCount: number;

	if (precomputed) {
		eligiblePool = precomputed.eligiblePool;
		noGaugePool = precomputed.noGaugePool;
		spawnCount = precomputed.spawnCount;
	} else {
		const field = fields[mapIndex];
		spawnCount = getPokemonCount(field.powers, drowsyPower);

		const currentRankStr = getRankForPower(mapIndex, config.snorlaxPower);
		const currentRankIndex = getRankIndex(currentRankStr);

		// Initial eligible pool: must be unlocked by rank and within initial drowsy power
		eligiblePool = subPool.filter((style) => {
			return (
				style.dpr <= drowsyPower &&
				(style.unlockRankIndex ?? 0) <= currentRankIndex
			);
		});

		// Form special no-gauge pool from ALL rank-unlocked styles in map subPool
		const noGaugeCandidates = subPool.filter((style) => {
			return (style.unlockRankIndex ?? 0) <= currentRankIndex;
		});

		// Sort ascending by DPR, then rank index, then name
		const sortedNoGauge = [...noGaugeCandidates].sort((a, b) => {
			if (a.dpr !== b.dpr) return a.dpr - b.dpr;
			const aRank = a.unlockRankIndex ?? 0;
			const bRank = b.unlockRankIndex ?? 0;
			if (aRank !== bRank) return aRank - bRank;
			return a.pokemon.localeCompare(b.pokemon);
		});

		noGaugePool = sortedNoGauge.slice(0, 10);
	}

	let remainingGauge = drowsyPower;
	let hasAtopBelly = false;
	const rolls: RollStep[] = [];
	let gaugeDepleted = false;

	for (let rollIdx = 1; rollIdx <= spawnCount; rollIdx++) {
		const isLast = rollIdx === spawnCount;

		// Find the index of the first style where dpr > remainingGauge
		let k = 0;
		while (k < eligiblePool.length && eligiblePool[k].dpr <= remainingGauge) {
			k++;
		}

		// Filter pool for this standard gauge roll without allocating lambda closures
		const rollPool: SleepStyle[] = [];
		for (let idx = 0; idx < k; idx++) {
			const style = eligiblePool[idx];
			if (hasAtopBelly && style.style === 4) {
				continue;
			}
			rollPool.push(style);
		}

		// Check if we have gauge and candidates
		if (!gaugeDepleted && rollPool.length > 0) {
			if (isLast) {
				// Last roll rules: exclude 3-star styles, exclude 4-star if already rolled
				const lastRollPool: SleepStyle[] = [];
				for (let idx = 0; idx < k; idx++) {
					const style = eligiblePool[idx];
					if (style.style === 3) continue;
					if (hasAtopBelly && style.style === 4) continue;
					lastRollPool.push(style);
				}

				// 20% chance to select from entire eligible list, 80% chance smaller list (exclude 4-star)
				let chosenLastPool = lastRollPool;
				if (Math.random() >= 0.2) {
					chosenLastPool = [];
					for (const s of lastRollPool) {
						if (s.style <= 2) {
							chosenLastPool.push(s);
						}
					}
				}
				if (chosenLastPool.length === 0) {
					chosenLastPool = lastRollPool;
				}

				if (chosenLastPool.length > 0) {
					// Deterministic pick: highest DPR style.
					// Tiebreaker: lowest scripted unlock rank, then lowest internal ID (pokemon name)
					const sortedPool = [...chosenLastPool].sort((a, b) => {
						if (b.dpr !== a.dpr) return b.dpr - a.dpr;
						const aRank = a.unlockRankIndex ?? 0;
						const bRank = b.unlockRankIndex ?? 0;
						if (aRank !== bRank) return aRank - bRank;
						return a.pokemon.localeCompare(b.pokemon);
					});

					const rolledStyle = sortedPool[0];
					const dprConsumed = rolledStyle.dpr;
					remainingGauge -= dprConsumed;
					if (rolledStyle.style === 4) {
						hasAtopBelly = true;
					}

					rolls.push({
						rollIndex: rollIdx,
						rolledStyle,
						dprConsumed,
						remainingGauge,
						isNoGaugeRoll: false,
						ruleApplied: `Rolled ${rolledStyle.pokemon} ${rolledStyle.style}⭐ (last roll deterministic choice from ${chosenLastPool.length} styles)`,
					});
					continue;
				}
				// If lastRollPool is empty, fall through to depleted gauge fallback
			} else {
				// Normal roll: uniform random from rollPool
				const randIdx = Math.floor(Math.random() * rollPool.length);
				const rolledStyle = rollPool[randIdx];
				const dprConsumed = rolledStyle.dpr;
				remainingGauge -= dprConsumed;
				if (rolledStyle.style === 4) {
					hasAtopBelly = true;
				}

				rolls.push({
					rollIndex: rollIdx,
					rolledStyle,
					dprConsumed,
					remainingGauge,
					isNoGaugeRoll: false,
					ruleApplied: `Rolled ${rolledStyle.pokemon} ${rolledStyle.style}⭐ (normal roll from ${rollPool.length} styles)`,
				});
				continue;
			}
		}

		// Depleted gauge roll fallback (or if pool was empty)
		gaugeDepleted = true;

		if (noGaugePool.length === 0) {
			// Absolute fallback if somehow no styles are unlocked yet (e.g. at start)
			// Draw from any style in subPool that is not 4-star (or if only 4-star, allow it)
			const fallbackPool = subPool.filter((s) => s.style !== 4);
			const rolledStyle =
				fallbackPool.length > 0 ? fallbackPool[0] : subPool[0];
			if (rolledStyle.style === 4) {
				hasAtopBelly = true;
			}
			rolls.push({
				rollIndex: rollIdx,
				rolledStyle,
				dprConsumed: 0,
				remainingGauge,
				isNoGaugeRoll: true,
				ruleApplied: `Rolled ${rolledStyle.pokemon} ${rolledStyle.style}⭐ (depleted gauge absolute fallback)`,
			});
			continue;
		}

		// Filter the pre-sliced top 10 list if it contains 4-star and hasAtopBelly is true:
		let activeNoGaugePool = noGaugePool;
		if (hasAtopBelly) {
			activeNoGaugePool = [];
			for (const s of noGaugePool) {
				if (s.style !== 4) {
					activeNoGaugePool.push(s);
				}
			}
		}
		if (activeNoGaugePool.length === 0) {
			activeNoGaugePool = noGaugePool;
		}

		const randIdx = Math.floor(Math.random() * activeNoGaugePool.length);
		const rolledStyle = activeNoGaugePool[randIdx];
		if (rolledStyle.style === 4) {
			hasAtopBelly = true;
		}

		rolls.push({
			rollIndex: rollIdx,
			rolledStyle,
			dprConsumed: 0,
			remainingGauge,
			isNoGaugeRoll: true,
			ruleApplied: `Rolled ${rolledStyle.pokemon} ${rolledStyle.style}⭐ (depleted gauge roll from top ${activeNoGaugePool.length} styles)`,
		});
	}

	return {
		drowsyPower,
		spawnCount,
		rolls,
		gaugeDepleted,
	};
}
