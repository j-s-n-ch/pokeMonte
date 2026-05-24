import { describe, expect, it } from "vitest";
import {
	getPowerForRank,
	getRankForPower,
	getRankIndex,
} from "./RankConverter";

describe("RankConverter", () => {
	it("correctly gets rank indices", () => {
		expect(getRankIndex("B1")).toBe(0);
		expect(getRankIndex("B5")).toBe(4);
		expect(getRankIndex("G1")).toBe(5);
		expect(getRankIndex("G5")).toBe(9);
		expect(getRankIndex("U1")).toBe(10);
		expect(getRankIndex("U5")).toBe(14);
		expect(getRankIndex("M1")).toBe(15);
		expect(getRankIndex("M3")).toBe(17);
		expect(getRankIndex("M20")).toBe(34);
	});

	it("throws on invalid ranks", () => {
		expect(() => getRankIndex("Z1")).toThrow();
		expect(() => getRankIndex("B")).toThrow();
	});

	it("correctly gets power for rank on Greengrass Isle (field 0)", () => {
		// Basic 1 power: 0
		expect(getPowerForRank(0, "B1")).toBe(0);
		// Basic 2 power: 3118
		expect(getPowerForRank(0, "B2")).toBe(3118);
		// Master 1 power: 187832
		expect(getPowerForRank(0, "M1")).toBe(187832);
		// Master 2 power: 220177
		expect(getPowerForRank(0, "M2")).toBe(220177);
	});

	it("correctly gets rank for power on Greengrass Isle (field 0)", () => {
		expect(getRankForPower(0, 0)).toBe("B1");
		expect(getRankForPower(0, 3117)).toBe("B1");
		expect(getRankForPower(0, 3118)).toBe("B2");
		expect(getRankForPower(0, 3119)).toBe("B2");
		expect(getRankForPower(0, 187832)).toBe("M1");
		expect(getRankForPower(0, 220177)).toBe("M2");
		expect(getRankForPower(0, 3500000)).toBe("M20");
	});
});
