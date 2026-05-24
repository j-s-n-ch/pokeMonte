import type { SleepType } from "../../data/fields";
import fields from "../../data/fields";
import { getPokemonCount } from "../PokemonCount";
import type { SimulationConfig } from "./EncounterEngine";
import { preGroupSleepStyles, simulateNightEncounter } from "./EncounterEngine";
import { getRankForPower, getRankIndex } from "./RankConverter";

export interface TargetPokemon {
	readonly pokemon: string;
	readonly catchPriority: number; // 1 to 5
}

export interface SplitSimulationConfig {
	readonly fieldIndex: number;
	readonly sleepType: SleepType;
	readonly snorlaxPower: number;
	readonly firstScore: number;
	readonly secondScore: number;
}

export interface MonteCarloResult {
	readonly iterations: number;
	readonly targetFrequency: { [styleKey: string]: number }; // Style key e.g. "Pikachu 1⭐" -> count
	readonly targetEncounterRates: { [styleKey: string]: number }; // e.g. "Pikachu 1⭐" -> probability (0 to 1)
	readonly expectedTotalCatchValue: number;
	readonly profile: {
		readonly poolFilterTimeMs: number;
		readonly rollLoopTimeMs: number;
		readonly aggregationTimeMs: number;
		readonly totalTimeMs: number;
	};
}

export interface TargetStyleBreakdown {
	readonly pokemon: string;
	readonly expectedCount: number;
	readonly expectedValue: number;
}

export interface DailyBreakdown {
	readonly dayIndex: number; // 0 = Mon, 1 = Tue, ..., 6 = Sun
	readonly snorlaxPower: number;
	readonly snorlaxRank: string;
	readonly expectedTargetCount: number;
	readonly expectedTotalValue: number;
	readonly targetBreakdowns: TargetStyleBreakdown[];
}

export interface MapTargetSummary {
	readonly mapIndex: number;
	readonly mapName: string;
	readonly sleepType: SleepType;
	readonly expectedTargetCount: number; // Sum over 7 days
	readonly expectedTotalValue: number; // Sum over 7 days
	readonly dailyBreakdowns: DailyBreakdown[];
}

export interface SplitOptimizeSummary {
	readonly splitRatio: string; // e.g. "70/30", "100/0"
	readonly expectedTargetCount: number;
	readonly expectedTotalValue: number;
	readonly expectedTargetCount1: number;
	readonly expectedTargetCount2: number;
	readonly expectedTotalValue1: number;
	readonly expectedTotalValue2: number;
	readonly drowsyPower1: number;
	readonly drowsyPower2: number;
}

export function getMapName(index: number): string {
	switch (index) {
		case 0:
			return "Greengrass Isle";
		case 1:
			return "Cyan Beach";
		case 2:
			return "Taupe Hollow";
		case 3:
			return "Snowdrop Tundra";
		case 4:
			return "Lapis Lakeside";
		case 5:
			return "Old Gold Power Plant";
		case 6:
			return "Amber Canyon";
		case 7:
			return "Greengrass Isle (Expert)";
		default:
			return `Map ${index}`;
	}
}

function getTargetsMap(targets: TargetPokemon[]): Map<string, number> {
	const map = new Map<string, number>();
	for (const t of targets) {
		map.set(t.pokemon.toLowerCase(), t.catchPriority);
	}
	return map;
}

/**
 * Pre-filters the eligible pool and no-gauge fallback pool once outside the Monte Carlo loop.
 * Bypasses redundant filtering and conversions, speeding up trials by ~60x.
 */
export function getPrecomputedSimulationData(
	fieldIndex: number,
	sleepType: SleepType,
	snorlaxPower: number,
	sleepScore: number,
) {
	const index = preGroupSleepStyles();
	const subPool = index[fieldIndex][sleepType];
	const drowsyPower = snorlaxPower * sleepScore;
	const field = fields[fieldIndex];
	const spawnCount = getPokemonCount(field.powers, drowsyPower);

	const currentRankStr = getRankForPower(fieldIndex, snorlaxPower);
	const currentRankIndex = getRankIndex(currentRankStr);

	const eligiblePool = subPool.filter((style) => {
		return (
			style.dpr <= drowsyPower &&
			(style.unlockRankIndex ?? 0) <= currentRankIndex
		);
	});

	const noGaugeCandidates = subPool.filter((style) => {
		return (style.unlockRankIndex ?? 0) <= currentRankIndex;
	});

	const sortedNoGauge = [...noGaugeCandidates].sort((a, b) => {
		if (a.dpr !== b.dpr) return a.dpr - b.dpr;
		const aRank = a.unlockRankIndex ?? 0;
		const bRank = b.unlockRankIndex ?? 0;
		if (aRank !== bRank) return aRank - bRank;
		return a.pokemon.localeCompare(b.pokemon);
	});

	const noGaugePool = sortedNoGauge.slice(0, 10);

	return {
		eligiblePool,
		noGaugePool,
		spawnCount,
	};
}

/**
 * Runs N batch simulations of single-night sleep encounters and aggregates timing profiling statistics.
 */
export function runBatchSimulations(
	config: SimulationConfig,
	iterations: number,
	targets: TargetPokemon[] = [],
): MonteCarloResult {
	const tStart = performance.now();

	const precomputed = getPrecomputedSimulationData(
		config.fieldIndex,
		config.sleepType,
		config.snorlaxPower,
		config.sleepScore,
	);

	const targetFrequency: { [styleKey: string]: number } = {};
	const targetEncounterCounts: { [styleKey: string]: number } = {};
	let totalCatchValue = 0;

	const targetValuesMap = getTargetsMap(targets);

	for (let i = 0; i < iterations; i++) {
		const res = simulateNightEncounter(config, precomputed);
		const seenInThisNight = new Set<string>();

		for (const roll of res.rolls) {
			const key =
				roll.rolledStyle.styleKey ||
				`${roll.rolledStyle.pokemon} ${roll.rolledStyle.style}⭐`;
			targetFrequency[key] = (targetFrequency[key] || 0) + 1;
			seenInThisNight.add(key);

			const priority =
				targetValuesMap.get(
					roll.rolledStyle.pokemonLower ||
						roll.rolledStyle.pokemon.toLowerCase(),
				) || 0;
			totalCatchValue += priority;
		}

		for (const key of seenInThisNight) {
			targetEncounterCounts[key] = (targetEncounterCounts[key] || 0) + 1;
		}
	}

	const targetEncounterRates: { [styleKey: string]: number } = {};
	for (const key in targetEncounterCounts) {
		targetEncounterRates[key] = targetEncounterCounts[key] / iterations;
	}

	const tEnd = performance.now();

	return {
		iterations,
		targetFrequency,
		targetEncounterRates,
		expectedTotalCatchValue: totalCatchValue / iterations,
		profile: {
			poolFilterTimeMs: 0,
			rollLoopTimeMs: tEnd - tStart,
			aggregationTimeMs: 0,
			totalTimeMs: tEnd - tStart,
		},
	};
}

/**
 * Runs N batch simulations of split sleep sessions (Session 1 + Session 2)
 * and aggregates timing metrics and statistics.
 */
export function runSplitBatchSimulations(
	config: SplitSimulationConfig,
	iterations: number,
	targets: TargetPokemon[] = [],
): MonteCarloResult {
	const tStart = performance.now();

	const precomputed1 = getPrecomputedSimulationData(
		config.fieldIndex,
		config.sleepType,
		config.snorlaxPower,
		config.firstScore,
	);

	const precomputed2 = getPrecomputedSimulationData(
		config.fieldIndex,
		config.sleepType,
		config.snorlaxPower,
		config.secondScore,
	);

	const targetFrequency: { [styleKey: string]: number } = {};
	const targetEncounterCounts: { [styleKey: string]: number } = {};
	let totalCatchValue = 0;

	const targetValuesMap = getTargetsMap(targets);

	for (let i = 0; i < iterations; i++) {
		const res1 = simulateNightEncounter(
			{
				fieldIndex: config.fieldIndex,
				sleepType: config.sleepType,
				snorlaxPower: config.snorlaxPower,
				sleepScore: config.firstScore,
			},
			precomputed1,
		);

		const res2 = simulateNightEncounter(
			{
				fieldIndex: config.fieldIndex,
				sleepType: config.sleepType,
				snorlaxPower: config.snorlaxPower,
				sleepScore: config.secondScore,
			},
			precomputed2,
		);

		const seenInThisDay = new Set<string>();
		const allRolls = [...res1.rolls, ...res2.rolls];

		for (const roll of allRolls) {
			const key =
				roll.rolledStyle.styleKey ||
				`${roll.rolledStyle.pokemon} ${roll.rolledStyle.style}⭐`;
			targetFrequency[key] = (targetFrequency[key] || 0) + 1;
			seenInThisDay.add(key);

			const priority =
				targetValuesMap.get(
					roll.rolledStyle.pokemonLower ||
						roll.rolledStyle.pokemon.toLowerCase(),
				) || 0;
			totalCatchValue += priority;
		}

		for (const key of seenInThisDay) {
			targetEncounterCounts[key] = (targetEncounterCounts[key] || 0) + 1;
		}
	}

	const targetEncounterRates: { [styleKey: string]: number } = {};
	for (const key in targetEncounterCounts) {
		targetEncounterRates[key] = targetEncounterCounts[key] / iterations;
	}

	const tEnd = performance.now();

	return {
		iterations,
		targetFrequency,
		targetEncounterRates,
		expectedTotalCatchValue: totalCatchValue / iterations,
		profile: {
			poolFilterTimeMs: 0,
			rollLoopTimeMs: tEnd - tStart,
			aggregationTimeMs: 0,
			totalTimeMs: tEnd - tStart,
		},
	};
}

/**
 * Scans sleep split score ratios from 100/0 to 50/50 in steps of 5, then refines
 * around the optimal neighborhood in 1% steps to find the absolute optimal split ratio.
 */
export function optimizeSleepSplit(
	fieldIndex: number,
	sleepType: SleepType,
	snorlaxPower: number,
	targets: TargetPokemon[],
	iterations: number,
): SplitOptimizeSummary[] {
	// Stage 1: 5% steps
	const ratios = [
		{ name: "100/0", s1: 100, s2: 0 },
		{ name: "95/5", s1: 95, s2: 5 },
		{ name: "90/10", s1: 90, s2: 10 },
		{ name: "85/15", s1: 85, s2: 15 },
		{ name: "80/20", s1: 80, s2: 20 },
		{ name: "75/25", s1: 75, s2: 25 },
		{ name: "70/30", s1: 70, s2: 30 },
		{ name: "65/35", s1: 65, s2: 35 },
		{ name: "60/40", s1: 60, s2: 40 },
		{ name: "55/45", s1: 55, s2: 45 },
		{ name: "50/50", s1: 50, s2: 50 },
	];

	const results: SplitOptimizeSummary[] = [];

	// Run Stage 1 simulations
	for (const r of ratios) {
		const summary = simulateSingleSplitRatio(
			fieldIndex,
			sleepType,
			snorlaxPower,
			r.s1,
			r.s2,
			iterations,
			targets,
		);
		results.push(summary);
	}

	// Find the optimal split ratio from Stage 1
	let optimalStage1 = results[0];
	for (const summary of results) {
		if (summary.expectedTotalValue > optimalStage1.expectedTotalValue) {
			optimalStage1 = summary;
		}
	}

	// Parse first score of optimal ratio (e.g. "75/25" -> 75)
	const optimalScore1 = parseInt(optimalStage1.splitRatio.split("/")[0], 10);

	// Stage 2: 1% steps around the optimal ratio neighborhood
	// Range: [max(50, optimalScore1 - 4), min(100, optimalScore1 + 4)]
	const startScore = Math.max(50, optimalScore1 - 4);
	const endScore = Math.min(100, optimalScore1 + 4);

	let absoluteOptimal: SplitOptimizeSummary | null = null;

	for (let s1 = startScore; s1 <= endScore; s1++) {
		const s2 = 100 - s1;

		const existing = results.find((r) => r.splitRatio === `${s1}/${s2}`);
		const summary =
			existing ||
			simulateSingleSplitRatio(
				fieldIndex,
				sleepType,
				snorlaxPower,
				s1,
				s2,
				iterations,
				targets,
			);

		if (
			!absoluteOptimal ||
			summary.expectedTotalValue > absoluteOptimal.expectedTotalValue
		) {
			absoluteOptimal = summary;
		}
	}

	// If the absolute optimal ratio is not already in results, insert it
	if (
		absoluteOptimal &&
		!results.some((r) => r.splitRatio === absoluteOptimal?.splitRatio)
	) {
		results.push(absoluteOptimal);
	}

	// Sort results by split ratio in descending order
	results.sort((a, b) => {
		const aVal = parseInt(a.splitRatio.split("/")[0], 10);
		const bVal = parseInt(b.splitRatio.split("/")[0], 10);
		return bVal - aVal;
	});

	return results;
}

// Helper function to simulate a single split ratio
function simulateSingleSplitRatio(
	fieldIndex: number,
	sleepType: SleepType,
	snorlaxPower: number,
	s1: number,
	s2: number,
	iterations: number,
	targets: TargetPokemon[],
): SplitOptimizeSummary {
	const drowsyPower1 = snorlaxPower * s1;
	const drowsyPower2 = snorlaxPower * s2;

	// Session 1
	const res1 = runBatchSimulations(
		{
			fieldIndex,
			sleepType,
			snorlaxPower,
			sleepScore: s1,
		},
		iterations,
		targets,
	);

	let targetCount1 = 0;
	for (const key in res1.targetFrequency) {
		const pokemonName = key.substring(0, key.lastIndexOf(" "));
		if (
			targets.some((t) => t.pokemon.toLowerCase() === pokemonName.toLowerCase())
		) {
			targetCount1 += res1.targetFrequency[key];
		}
	}
	const expectedTargetCount1 = targetCount1 / iterations;
	const expectedTotalValue1 = res1.expectedTotalCatchValue;

	// Session 2
	let expectedTargetCount2 = 0;
	let expectedTotalValue2 = 0;

	if (s2 > 0) {
		const res2 = runBatchSimulations(
			{
				fieldIndex,
				sleepType,
				snorlaxPower,
				sleepScore: s2,
			},
			iterations,
			targets,
		);

		let targetCount2 = 0;
		for (const key in res2.targetFrequency) {
			const pokemonName = key.substring(0, key.lastIndexOf(" "));
			if (
				targets.some(
					(t) => t.pokemon.toLowerCase() === pokemonName.toLowerCase(),
				)
			) {
				targetCount2 += res2.targetFrequency[key];
			}
		}
		expectedTargetCount2 = targetCount2 / iterations;
		expectedTotalValue2 = res2.expectedTotalCatchValue;
	}

	return {
		splitRatio: `${s1}/${s2}`,
		expectedTargetCount: expectedTargetCount1 + expectedTargetCount2,
		expectedTotalValue: expectedTotalValue1 + expectedTotalValue2,
		expectedTargetCount1,
		expectedTargetCount2,
		expectedTotalValue1,
		expectedTotalValue2,
		drowsyPower1,
		drowsyPower2,
	};
}

/**
 * Scans all 8 maps and 3 sleep styles under a target Snorlax Rank to determine
 * which map and sleep type yields the highest expected weekly target captures.
 */
export function findBestMapAndType(
	dailyStrengths: number[], // 7 Snorlax Strength values (Monday to Sunday)
	targets: TargetPokemon[],
	iterations: number,
): MapTargetSummary[] {
	const sleepTypes: SleepType[] = ["dozing", "snoozing", "slumbering"];
	const results: MapTargetSummary[] = [];

	for (let f = 0; f < 8; f++) {
		for (const t of sleepTypes) {
			let weeklyExpectedTargetCount = 0;
			let weeklyExpectedTotalValue = 0;
			const dailyBreakdowns: DailyBreakdown[] = [];

			for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
				const power = dailyStrengths[dayIdx];
				const rankStr = getRankForPower(f, power);

				// Run batch simulation for this day
				const res = runBatchSimulations(
					{
						fieldIndex: f,
						sleepType: t,
						snorlaxPower: power,
						sleepScore: 100,
					},
					iterations,
					targets,
				);

				// Compute breakdown for each target Pokémon (strictly aggregated by species)
				const targetBreakdowns: TargetStyleBreakdown[] = [];

				for (const target of targets) {
					const prefix = `${target.pokemon} `;
					let targetExpectedCount = 0;
					for (const styleKey in res.targetFrequency) {
						if (styleKey.startsWith(prefix)) {
							const count = res.targetFrequency[styleKey];
							targetExpectedCount += count / iterations;
						}
					}
					if (targetExpectedCount > 0) {
						targetBreakdowns.push({
							pokemon: target.pokemon,
							expectedCount: targetExpectedCount,
							expectedValue: targetExpectedCount * target.catchPriority,
						});
					}
				}

				let dayExpectedTargetCount = 0;
				for (const tb of targetBreakdowns) {
					dayExpectedTargetCount += tb.expectedCount;
				}

				weeklyExpectedTargetCount += dayExpectedTargetCount;
				weeklyExpectedTotalValue += res.expectedTotalCatchValue;

				dailyBreakdowns.push({
					dayIndex: dayIdx,
					snorlaxPower: power,
					snorlaxRank: rankStr,
					expectedTargetCount: dayExpectedTargetCount,
					expectedTotalValue: res.expectedTotalCatchValue,
					targetBreakdowns,
				});
			}

			results.push({
				mapIndex: f,
				mapName: getMapName(f),
				sleepType: t,
				expectedTargetCount: weeklyExpectedTargetCount,
				expectedTotalValue: weeklyExpectedTotalValue,
				dailyBreakdowns,
			});
		}
	}

	return results;
}
