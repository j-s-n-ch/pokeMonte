import fields from "../../data/fields";

/**
 * Translates Snorlax rank abbreviation (e.g. "B2", "G1", "U5", "M20") to its raw index (0-34).
 * Basic: index 0-4
 * Great: index 5-9
 * Ultra: index 10-14
 * Master: index 15-34
 *
 * @param rankStr Rank abbreviation
 * @returns Rank index (0-34)
 */
export function getRankIndex(rankStr: string | null | undefined): number {
	if (!rankStr) {
		return 0; // Default to Basic 1 (index 0) if no rank restriction exists
	}
	const typeChar = rankStr.charAt(0);
	const level = parseInt(rankStr.substring(1), 10);
	if (Number.isNaN(level)) {
		throw new Error(`Invalid rank string: ${rankStr}`);
	}

	switch (typeChar) {
		case "B":
			return level - 1;
		case "G":
			return 5 + level - 1;
		case "U":
			return 10 + level - 1;
		case "M":
			return 15 + level - 1;
		default:
			throw new Error(`Invalid rank type character: ${typeChar}`);
	}
}

/**
 * Get Snorlax Power required to unlock a rank on a specific map.
 *
 * @param fieldIndex Field index (0-7)
 * @param rankStr Snorlax Rank string (e.g. "B2")
 * @returns Snorlax power required
 */
export function getPowerForRank(fieldIndex: number, rankStr: string): number {
	const field = fields[fieldIndex];
	if (!field) {
		throw new Error(`Field with index ${fieldIndex} does not exist.`);
	}
	const rankIndex = getRankIndex(rankStr);
	return field.ranks[rankIndex];
}

/**
 * Find the Snorlax Rank string achieved with a given Snorlax Power on a specific map.
 *
 * @param fieldIndex Field index (0-7)
 * @param power Snorlax power
 * @returns Snorlax rank abbreviation (e.g. "B2")
 */
export function getRankForPower(fieldIndex: number, power: number): string {
	const field = fields[fieldIndex];
	if (!field) {
		throw new Error(`Field with index ${fieldIndex} does not exist.`);
	}

	const ranks = field.ranks;
	let rankIndex = 0;
	for (let i = 0; i < ranks.length; i++) {
		if (power < ranks[i]) {
			break;
		}
		rankIndex = i;
	}

	let typeChar = "B";
	let num = 1;
	if (rankIndex < 5) {
		typeChar = "B";
		num = rankIndex + 1;
	} else if (rankIndex < 10) {
		typeChar = "G";
		num = rankIndex - 4;
	} else if (rankIndex < 15) {
		typeChar = "U";
		num = rankIndex - 9;
	} else {
		typeChar = "M";
		num = rankIndex - 14;
	}

	return `${typeChar}${num}`;
}
