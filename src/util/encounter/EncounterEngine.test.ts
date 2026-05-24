import { describe, expect, it } from "vitest";
import { preGroupSleepStyles, simulateNightEncounter } from "./EncounterEngine";

describe("EncounterEngine", () => {
	it("correctly pre-groups styles by map and sleep type", () => {
		const index = preGroupSleepStyles();
		expect(index[0]).toBeDefined();
		expect(index[0].dozing).toBeInstanceOf(Array);
		expect(index[0].dozing.length).toBeGreaterThan(0);
		// Sorted ascending
		const dozing = index[0].dozing;
		for (let i = 0; i < dozing.length - 1; i++) {
			expect(dozing[i].dpr).toBeLessThanOrEqual(dozing[i + 1].dpr);
		}
	});

	it("simulates rolls under normal high power on Cyan Beach (field 1, snoozing)", () => {
		const result = simulateNightEncounter({
			fieldIndex: 1,
			sleepType: "snoozing",
			snorlaxPower: 1200000,
			sleepScore: 100,
		});

		expect(result.drowsyPower).toBe(120000000);
		expect(result.spawnCount).toBe(8);
		expect(result.rolls.length).toBe(8);

		// Make sure at most one 4-star sleep style was rolled
		const fourStars = result.rolls.filter((r) => r.rolledStyle.style === 4);
		expect(fourStars.length).toBeLessThanOrEqual(1);

		// Gauge remaining should decrease with rolls (until/if depleted)
		for (let i = 0; i < result.rolls.length; i++) {
			const roll = result.rolls[i];
			expect(roll.rollIndex).toBe(i + 1);
			expect(roll.rolledStyle).toBeDefined();
		}
	});

	it("falls back to depleted gauge when power is extremely low on Greengrass (field 0, dozing)", () => {
		const result = simulateNightEncounter({
			fieldIndex: 0,
			sleepType: "dozing",
			snorlaxPower: 1000,
			sleepScore: 50,
		});

		expect(result.drowsyPower).toBe(50000);
		expect(result.spawnCount).toBe(3); // minimum spawns is 3
		expect(result.rolls.length).toBe(3);
		expect(result.gaugeDepleted).toBe(true);

		// All rolls should be no-gauge rolls
		for (const roll of result.rolls) {
			expect(roll.isNoGaugeRoll).toBe(true);
			expect(roll.ruleApplied).toContain("depleted gauge");
		}
	});
});
