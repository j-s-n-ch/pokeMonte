const fs = require("node:fs");
const path = require("node:path");

const pokemonPath = path.join(__dirname, "../src/data/pokemon.json");
const outputDir = path.join(__dirname, "../public/images/pokemon/icons");

// Ensure output directory exists
fs.mkdirSync(outputDir, { recursive: true });

const pokemonList = JSON.parse(fs.readFileSync(pokemonPath, "utf8"));

const formMap = {
	Halloween: 1,
	Holiday: 2,
	Alola: 3,
	Paldea: 4,
	Amped: 5,
	"Low Key": 6,
	Small: 7,
	Medium: 8,
	Large: 9,
	Jumbo: 10,
};

// Hardcoded custom form ID mappings for the image asset server
const specialMap = {
	"Wooper (Paldea)": "7054",
	"Vulpix (Alola)": "7006",
	"Ninetales (Alola)": "7007",
	"Toxtricity (Low Key)": "8001",
	"Toxtricity (Amped)": "849",
};

async function downloadIcon(iconId, idForm, pokemonName) {
	// The script fetches icons from a configured CDN or image database.
	// For example, icons can be fetched from a custom asset provider or CDN API.
	// Set the POKEMON_ICON_CDN environment variable or modify the URL prefix as needed.
	const cdnPrefix =
		process.env.POKEMON_ICON_CDN || "https://example.com/api/image/pks";
	const url = `${cdnPrefix}?id=${iconId}`;
	const destPath = path.join(outputDir, `${idForm}.webp`);

	try {
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(`Status ${res.status}`);
		}
		const buffer = await res.arrayBuffer();
		fs.writeFileSync(destPath, Buffer.from(buffer));
		console.log(`Downloaded ${pokemonName} (icon ${iconId}) -> ${idForm}.webp`);
		return true;
	} catch (err) {
		console.error(
			`Failed to download ${pokemonName} (icon ${iconId}): ${err.message}`,
		);
		return false;
	}
}

async function main() {
	console.log(`Starting download for ${pokemonList.length} Pokemon...`);
	let successCount = 0;
	let failCount = 0;

	for (const p of pokemonList) {
		const baseId = p.id;
		const name = p.name;
		const form = p.form;

		// Calculate idForm matching PokemonIv.idForm
		const formVal = form ? formMap[form] || 0 : 0;
		const idForm = baseId + (formVal << 12);

		// Determine custom icon ID
		let iconId = baseId.toString();
		if (specialMap[name]) {
			iconId = specialMap[name];
		}

		// Try to download
		let success = await downloadIcon(iconId, idForm, name);
		if (success) {
			successCount++;
		} else {
			// If it failed and it's a form, try falling back to the base Pokedex ID
			if (form) {
				console.log(`Retrying ${name} with base Pokedex ID ${baseId}...`);
				success = await downloadIcon(baseId.toString(), idForm, name);
				if (success) {
					successCount++;
				} else {
					failCount++;
				}
			} else {
				failCount++;
			}
		}

		// Brief delay
		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	console.log(
		`Downloads complete! Success: ${successCount}, Failed: ${failCount}`,
	);
}

main();
