import { describe, expect, it } from "vitest";
import {
	findBestMapAndType,
	optimizeSleepSplit,
	runBatchSimulations,
	runSplitBatchSimulations,
} from "./MonteCarloEngine";

describe("MonteCarloEngine", () => {
	const targets = [
		{ pokemon: "Bulbasaur", catchPriority: 5 },
		{ pokemon: "Pikachu", catchPriority: 3 },
	];

	it("runs batch single simulations and aggregates expected target catch values", () => {
		const res = runBatchSimulations(
			{
				fieldIndex: 0,
				sleepType: "dozing",
				snorlaxPower: 300000,
				sleepScore: 100,
			},
			50,
			targets,
		);

		expect(res.iterations).toBe(50);
		expect(res.expectedTotalCatchValue).toBeGreaterThanOrEqual(0);
		expect(res.profile.rollLoopTimeMs).toBeGreaterThanOrEqual(0);
		expect(res.profile.totalTimeMs).toBeGreaterThan(0);
	});

	it("runs batch split simulations", () => {
		const res = runSplitBatchSimulations(
			{
				fieldIndex: 0,
				sleepType: "dozing",
				snorlaxPower: 300000,
				firstScore: 70,
				secondScore: 30,
			},
			20,
			targets,
		);

		expect(res.iterations).toBe(20);
		expect(res.expectedTotalCatchValue).toBeGreaterThanOrEqual(0);
		expect(res.profile.rollLoopTimeMs).toBeGreaterThanOrEqual(0);
	});

	it("optimizes sleep split ratios", () => {
		const res = optimizeSleepSplit(0, "dozing", 200000, targets, 10);
		expect(res.length).toBeGreaterThanOrEqual(11);
		expect(res.length).toBeLessThanOrEqual(12);
		for (const summary of res) {
			expect(summary.splitRatio).toBeDefined();
			expect(summary.expectedTargetCount).toBeGreaterThanOrEqual(0);
			expect(summary.expectedTotalValue).toBeGreaterThanOrEqual(0);
		}
	});

	it("scans best map and sleep type combinations", () => {
		const res = findBestMapAndType(
			[20000, 40000, 60000, 80000, 100000, 120000, 150000],
			targets,
			5,
		);
		// 8 maps * 3 sleep types = 24 entries
		expect(res.length).toBe(24);
		for (const entry of res) {
			expect(entry.mapName).toBeDefined();
			expect(entry.sleepType).toBeDefined();
			expect(entry.expectedTargetCount).toBeGreaterThanOrEqual(0);
			expect(entry.expectedTotalValue).toBeGreaterThanOrEqual(0);
		}
	});
});
