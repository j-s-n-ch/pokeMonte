import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {
	Box,
	Button,
	Checkbox,
	Collapse,
	Divider,
	FormControlLabel,
	IconButton,
	MenuItem,
	Slider,
	Tab,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Tabs,
	TextField,
	Typography,
} from "@mui/material";
import { styled } from "@mui/system";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import fields from "../../data/fields";
import pokemons from "../../data/pokemons";
import {
	type SimulationResult,
	simulateNightEncounter,
} from "../../util/encounter/EncounterEngine";
import {
	type DailyBreakdown,
	findBestMapAndType,
	type MapTargetSummary,
	optimizeSleepSplit,
	type SplitOptimizeSummary,
	type TargetPokemon,
	type TargetStyleBreakdown,
} from "../../util/encounter/MonteCarloEngine";
import PokemonIv from "../../util/PokemonIv";
import Rank from "../../util/Rank";
import NumericInput from "../common/NumericInput";
import PokemonIcon from "../IvCalc/PokemonIcon";
import RankBall from "./RankBallLabel";

function expandRankStr(rankStr: string): string {
	if (!rankStr) return "";
	const type = rankStr.charAt(0);
	const num = rankStr.substring(1);
	switch (type) {
		case "B":
			return `Basic ${num}`;
		case "G":
			return `Great ${num}`;
		case "U":
			return `Ultra ${num}`;
		case "M":
			return `Master ${num}`;
		default:
			return rankStr;
	}
}

function HuntFinderRow({
	row,
	getPokemonIdForm,
}: {
	row: MapTargetSummary;
	getPokemonIdForm: (name: string) => number;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<TableRow
				onClick={() => setOpen(!open)}
				sx={{
					"& > *": { borderBottom: "unset" },
					cursor: "pointer",
					"&:hover": { backgroundColor: "rgba(255, 255, 255, 0.02)" },
				}}
			>
				<TableCell sx={{ width: "40px", padding: "6px" }}>
					<IconButton size="small">
						{open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
					</IconButton>
				</TableCell>
				<TableCell sx={{ fontWeight: "bold" }}>{row.mapName}</TableCell>
				<TableCell>{row.sleepType.toUpperCase()}</TableCell>
				<TableCell align="right">
					{row.expectedTargetCount.toFixed(3)}
				</TableCell>
				<TableCell align="right">{row.expectedTotalValue.toFixed(2)}</TableCell>
			</TableRow>
			<TableRow>
				<TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
					<Collapse in={open} timeout="auto" unmountOnExit>
						<Box sx={{ margin: 1, paddingBottom: 2 }}>
							<Typography
								variant="subtitle2"
								gutterBottom
								component="div"
								fontWeight="bold"
							>
								Daily Snorlax Strength & Target Breakdowns:
							</Typography>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Day</TableCell>
										<TableCell>Snorlax Rank</TableCell>
										<TableCell align="right">Snorlax Strength</TableCell>
										<TableCell align="right">Target Count</TableCell>
										<TableCell align="right">Target Value</TableCell>
										<TableCell>Target Species Yields</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{row.dailyBreakdowns.map((day: DailyBreakdown) => {
										const dayName = [
											"Monday",
											"Tuesday",
											"Wednesday",
											"Thursday",
											"Friday",
											"Saturday",
											"Sunday",
										][day.dayIndex];
										return (
											<TableRow key={day.dayIndex}>
												<TableCell sx={{ fontWeight: "bold" }}>
													{dayName}
												</TableCell>
												<TableCell>{expandRankStr(day.snorlaxRank)}</TableCell>
												<TableCell align="right">
													{day.snorlaxPower.toLocaleString()}
												</TableCell>
												<TableCell align="right">
													{day.expectedTargetCount.toFixed(3)}
												</TableCell>
												<TableCell align="right">
													{day.expectedTotalValue.toFixed(2)}
												</TableCell>
												<TableCell>
													{day.targetBreakdowns.length > 0 ? (
														<Box
															sx={{
																display: "flex",
																gap: "0.8rem",
																flexWrap: "wrap",
															}}
														>
															{day.targetBreakdowns.map(
																(tb: TargetStyleBreakdown) => (
																	<Box
																		key={tb.pokemon}
																		sx={{
																			display: "flex",
																			alignItems: "center",
																			gap: "0.2rem",
																			background: "rgba(255, 255, 255, 0.04)",
																			padding: "0.1rem 0.4rem",
																			borderRadius: "4px",
																			border:
																				"1px solid rgba(255, 255, 255, 0.05)",
																		}}
																	>
																		<PokemonIcon
																			idForm={getPokemonIdForm(tb.pokemon)}
																			size={18}
																		/>
																		<Typography variant="caption">
																			{tb.pokemon}:{" "}
																			{tb.expectedCount.toFixed(3)} (Val:{" "}
																			{tb.expectedValue.toFixed(2)})
																		</Typography>
																	</Box>
																),
															)}
														</Box>
													) : (
														<span style={{ color: "#999" }}>None</span>
													)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</Box>
					</Collapse>
				</TableCell>
			</TableRow>
		</>
	);
}

function PrioritySlider({
	value,
	onChange,
}: {
	value: number;
	onChange: (val: number) => void;
}) {
	return (
		<Box sx={{ width: "160px", mx: "15px", display: "inline-block", mt: 1 }}>
			<Slider
				value={value}
				min={1}
				max={5}
				step={1}
				marks={[
					{ value: 1, label: "1 (Low)" },
					{ value: 5, label: "5 (High)" },
				]}
				onChange={(_e, val) => onChange(Number(val))}
				valueLabelDisplay="auto"
				sx={{
					"& .MuiSlider-markLabel": {
						fontSize: "0.75rem",
						color: "text.secondary",
						mt: 0.5,
					},
				}}
			/>
		</Box>
	);
}

export default function EncounterSimulatorTab() {
	// Standard inputs
	const [fieldIndex, setFieldIndex] = useState<number>(() => {
		const cached = localStorage.getItem("pokesleep_sim_fieldIndex");
		return cached !== null ? Number(cached) : 0;
	});
	const [sleepType, setSleepType] = useState<
		"dozing" | "snoozing" | "slumbering"
	>("dozing");
	const [snorlaxPower, setSnorlaxPower] = useState<number>(() => {
		const cached = localStorage.getItem("pokesleep_sim_snorlaxPower");
		return cached !== null ? Number(cached) : 200000;
	});
	const [bonus, setBonus] = useState<number>(1.0);
	const [sleepTwice, setSleepTwice] = useState<boolean>(false);
	const [firstScore, setFirstScore] = useState<number>(70);

	// Snorlax expected strength profile per day of the week (Mon-Sun)
	const [dailyStrengths, setDailyStrengths] = useState<number[]>(() => {
		const cached = localStorage.getItem("pokesleep_sim_dailyStrengths");
		if (cached !== null) {
			try {
				return JSON.parse(cached);
			} catch {}
		}
		return [1, 2, 3, 4, 5, 6, 7].map((n) => 200000 * n);
	});
	const [averageStrength, setAverageStrength] = useState<number>(() => {
		const cached = localStorage.getItem("pokesleep_sim_averageStrength");
		return cached !== null ? Number(cached) : 200000;
	});

	const handleAverageStrengthChange = useCallback((val: number) => {
		setAverageStrength(val);
		setDailyStrengths([
			val * 1,
			val * 2,
			val * 3,
			val * 4,
			val * 5,
			val * 6,
			val * 7,
		]);
	}, []);

	const handleDailyStrengthChange = useCallback(
		(dayIdx: number, val: number) => {
			setDailyStrengths((prev) => {
				const next = [...prev];
				next[dayIdx] = val;
				return next;
			});
		},
		[],
	);

	// Targets state
	const [targets, setTargets] = useState<TargetPokemon[]>(() => {
		const cached = localStorage.getItem("pokesleep_sim_targets");
		if (cached !== null) {
			try {
				return JSON.parse(cached);
			} catch {}
		}
		return [
			{ pokemon: "Bulbasaur", catchPriority: 5 },
			{ pokemon: "Pikachu", catchPriority: 3 },
		];
	});
	const [selectedPokemonName, setSelectedPokemonName] = useState<string | null>(
		null,
	);
	const [selectedPriority, setSelectedPriority] = useState<number>(3);

	const pokemonOptions = useMemo(() => {
		const names = pokemons.map((p) => p.name);
		return Array.from(new Set(names)).sort();
	}, []);

	// Keyboard Autocomplete and Priority Slider States
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
	const [highlightedIdx, setHighlightedIdx] = useState<number>(-1);

	useEffect(() => {
		localStorage.setItem("pokesleep_sim_fieldIndex", String(fieldIndex));
	}, [fieldIndex]);

	useEffect(() => {
		localStorage.setItem("pokesleep_sim_snorlaxPower", String(snorlaxPower));
	}, [snorlaxPower]);

	useEffect(() => {
		localStorage.setItem(
			"pokesleep_sim_averageStrength",
			String(averageStrength),
		);
	}, [averageStrength]);

	useEffect(() => {
		localStorage.setItem(
			"pokesleep_sim_dailyStrengths",
			JSON.stringify(dailyStrengths),
		);
	}, [dailyStrengths]);

	useEffect(() => {
		localStorage.setItem("pokesleep_sim_targets", JSON.stringify(targets));
	}, [targets]);

	const filteredOptions = useMemo(() => {
		if (!searchQuery) return [];
		return pokemonOptions
			.filter((name) => name.toLowerCase().includes(searchQuery.toLowerCase()))
			.slice(0, 5);
	}, [searchQuery, pokemonOptions]);

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (filteredOptions.length > 0) {
				setDropdownOpen(true);
				if (highlightedIdx === -1) {
					setHighlightedIdx(filteredOptions.length > 1 ? 1 : 0);
				} else {
					setHighlightedIdx((highlightedIdx + 1) % filteredOptions.length);
				}
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (filteredOptions.length > 0) {
				setDropdownOpen(true);
				if (highlightedIdx === -1) {
					setHighlightedIdx(filteredOptions.length - 1);
				} else {
					setHighlightedIdx(
						(highlightedIdx - 1 + filteredOptions.length) %
							filteredOptions.length,
					);
				}
			}
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (filteredOptions.length === 1) {
				const pokemonName = filteredOptions[0];
				if (
					!targets.some(
						(t) => t.pokemon.toLowerCase() === pokemonName.toLowerCase(),
					)
				) {
					setTargets((prev) => [
						...prev,
						{ pokemon: pokemonName, catchPriority: selectedPriority },
					]);
				}
				setSearchQuery("");
				setSelectedPokemonName(null);
				setDropdownOpen(false);
				setHighlightedIdx(-1);
			} else if (filteredOptions.length > 1) {
				const targetIdx = highlightedIdx !== -1 ? highlightedIdx : 0;
				const pokemonName = filteredOptions[targetIdx];
				setSelectedPokemonName(pokemonName);
				setSearchQuery(pokemonName);
				setDropdownOpen(false);
				setHighlightedIdx(-1);
			}
		} else if (e.key === "Escape") {
			setDropdownOpen(false);
			setHighlightedIdx(-1);
		}
	};

	const handleSelectOption = (option: string) => {
		setSelectedPokemonName(option);
		setSearchQuery(option);
		setDropdownOpen(false);
		setHighlightedIdx(-1);
	};

	// Tabs state
	const [activeTab, setActiveTab] = useState<number>(0);
	const [targetsExpanded, setTargetsExpanded] = useState<boolean>(true);

	// Outputs state
	const [sessionResult1, setSessionResult1] = useState<SimulationResult | null>(
		null,
	);
	const [sessionResult2, setSessionResult2] = useState<SimulationResult | null>(
		null,
	);
	const [splitResults, setSplitResults] = useState<
		SplitOptimizeSummary[] | null
	>(null);
	const [mapResults, setMapResults] = useState<MapTargetSummary[] | null>(null);

	const [isSimulating, setIsSimulating] = useState<boolean>(false);
	const [simTimeMs, setSimTimeMs] = useState<number | null>(null);

	// Active rank data
	const field = useMemo(() => fields[fieldIndex], [fieldIndex]);
	const currentRank = useMemo(
		() => new Rank(snorlaxPower, field.ranks),
		[snorlaxPower, field.ranks],
	);

	const handleRankChange = useCallback(
		(rankIndex: number) => {
			if (rankIndex >= 0 && rankIndex < field.ranks.length) {
				setSnorlaxPower(field.ranks[rankIndex]);
			}
		},
		[field.ranks],
	);

	const getPokemonIdForm = useCallback((name: string) => {
		try {
			return new PokemonIv({ pokemonName: name }).idForm;
		} catch {
			return 0;
		}
	}, []);

	const handleAddTarget = useCallback(() => {
		if (!selectedPokemonName) return;
		if (
			targets.some(
				(t) => t.pokemon.toLowerCase() === selectedPokemonName.toLowerCase(),
			)
		) {
			return;
		}
		setTargets([
			...targets,
			{ pokemon: selectedPokemonName, catchPriority: selectedPriority },
		]);
		setSelectedPokemonName(null);
		setSearchQuery("");
	}, [selectedPokemonName, selectedPriority, targets]);

	const handleRemoveTarget = useCallback(
		(name: string) => {
			setTargets(
				targets.filter((t) => t.pokemon.toLowerCase() !== name.toLowerCase()),
			);
		},
		[targets],
	);

	// Run Sleep Session Roll
	const handleRunRollSession = useCallback(() => {
		setIsSimulating(true);
		const t0 = performance.now();
		try {
			const activeBonusPower = snorlaxPower * bonus;
			if (sleepTwice) {
				const score2 = 100 - firstScore;
				const res1 = simulateNightEncounter({
					fieldIndex,
					sleepType,
					snorlaxPower: activeBonusPower,
					sleepScore: firstScore,
				});
				const res2 = simulateNightEncounter({
					fieldIndex,
					sleepType,
					snorlaxPower: activeBonusPower,
					sleepScore: score2,
				});
				setSessionResult1(res1);
				setSessionResult2(res2);
			} else {
				const res = simulateNightEncounter({
					fieldIndex,
					sleepType,
					snorlaxPower: activeBonusPower,
					sleepScore: 100,
				});
				setSessionResult1(res);
				setSessionResult2(null);
			}
		} catch (e) {
			console.error(e);
		}
		setSimTimeMs(performance.now() - t0);
		setIsSimulating(false);
	}, [fieldIndex, sleepType, snorlaxPower, bonus, sleepTwice, firstScore]);

	// Run Hunt Finder Solver
	const handleRunHuntFinder = useCallback(() => {
		setIsSimulating(true);
		setSimTimeMs(null);
		setTimeout(() => {
			const t0 = performance.now();
			try {
				const activeStrengths = dailyStrengths.map((s) => s * bonus);
				const res = findBestMapAndType(activeStrengths, targets, 10000);
				const sorted = [...res].sort(
					(a, b) => b.expectedTotalValue - a.expectedTotalValue,
				);
				setMapResults(sorted);
			} catch (e) {
				console.error(e);
			}
			setSimTimeMs(performance.now() - t0);
			setIsSimulating(false);
		}, 50);
	}, [dailyStrengths, bonus, targets]);

	// Run Split Optimizer
	const handleRunSplitOptimizer = useCallback(() => {
		setIsSimulating(true);
		setSimTimeMs(null);
		setTimeout(() => {
			const t0 = performance.now();
			try {
				const res = optimizeSleepSplit(
					fieldIndex,
					sleepType,
					snorlaxPower * bonus,
					targets,
					10000,
				);
				setSplitResults(res);
			} catch (e) {
				console.error(e);
			}
			setSimTimeMs(performance.now() - t0);
			setIsSimulating(false);
		}, 50);
	}, [fieldIndex, sleepType, snorlaxPower, bonus, targets]);

	// Build Snorlax Rank Menu Items
	const rankMenuItems = useMemo(() => {
		const items = [];
		for (let i = 0; i < 35; i++) {
			const rankType = Rank.rankIndexToType(i);
			const rankNumber = Rank.rankIndexToRankNumber(i);
			items.push(
				<MenuItem key={i} value={i} dense>
					<RankBall type={rankType} number={rankNumber} />
				</MenuItem>,
			);
		}
		return items;
	}, []);

	return (
		<StyledWrapper>
			<StyledForm>
				<div>Research area:</div>
				<div>
					<TextField
						variant="standard"
						select
						value={fieldIndex}
						onChange={(e) => setFieldIndex(Number(e.target.value))}
					>
						<MenuItem value={0}>🌱 Greengrass Isle</MenuItem>
						<MenuItem value={1}>🏝️ Cyan Beach</MenuItem>
						<MenuItem value={2}>⛰️ Taupe Hollow</MenuItem>
						<MenuItem value={3}>⛄ Snowdrop Tundra</MenuItem>
						<MenuItem value={4}>🚢 Lapis Lakeside</MenuItem>
						<MenuItem value={5}>⚡️ Old Gold Power Plant</MenuItem>
						<MenuItem value={6}>🏜️ Amber Canyon</MenuItem>
						<MenuItem value={7}>🌱 Greengrass Isle (Expert)</MenuItem>
					</TextField>
				</div>

				<div>Snorlax strength:</div>
				<div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
					<TextField
						variant="standard"
						select
						value={currentRank.index}
						onChange={(e) => handleRankChange(Number(e.target.value))}
						sx={{ width: "80px" }}
						SelectProps={{
							MenuProps: {
								sx: { height: "400px" },
								anchorOrigin: { vertical: "bottom", horizontal: "left" },
								transformOrigin: { vertical: "top", horizontal: "left" },
							},
						}}
					>
						{rankMenuItems}
					</TextField>
					<TextField
						variant="standard"
						type="number"
						value={snorlaxPower}
						onChange={(e) =>
							setSnorlaxPower(Math.max(0, Number(e.target.value)))
						}
						sx={{ width: "120px" }}
					/>
				</div>

				<div>Sleep type:</div>
				<div>
					<TextField
						variant="standard"
						select
						value={sleepType}
						onChange={(e) =>
							setSleepType(
								e.target.value as "dozing" | "snoozing" | "slumbering",
							)
						}
					>
						<MenuItem value="dozing">Dozing</MenuItem>
						<MenuItem value="snoozing">Snoozing</MenuItem>
						<MenuItem value="slumbering">Slumbering</MenuItem>
					</TextField>
				</div>

				<div>Event bonus:</div>
				<div>
					<TextField
						variant="standard"
						select
						value={bonus}
						onChange={(e) => setBonus(Number(e.target.value))}
					>
						<MenuItem value={1.0}>None</MenuItem>
						<MenuItem value={1.5}>x1.5</MenuItem>
						<MenuItem value={2.0}>x2.0</MenuItem>
						<MenuItem value={2.5}>x2.5</MenuItem>
						<MenuItem value={3.0}>x3.0</MenuItem>
						<MenuItem value={4.0}>x4.0</MenuItem>
					</TextField>
				</div>

				<div>Sleep twice a day:</div>
				<div>
					<FormControlLabel
						control={
							<Checkbox
								checked={sleepTwice}
								onChange={(e) => setSleepTwice(e.target.checked)}
							/>
						}
						label=""
					/>
				</div>

				{sleepTwice && (
					<>
						<div>First sleep score:</div>
						<div>
							<Box
								sx={{
									display: "flex",
									gap: "1.5rem",
									alignItems: "center",
									width: "260px",
								}}
							>
								<Slider
									value={firstScore}
									min={1}
									max={99}
									onChange={(_e, v) => setFirstScore(Number(v))}
									sx={{ color: "#f7ac33" }}
								/>
								<Typography variant="body2">
									{firstScore} / {100 - firstScore}
								</Typography>
							</Box>
						</div>
					</>
				)}
			</StyledForm>

			<Divider sx={{ my: 3 }} />

			{/* Sub tabs */}
			<Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
				<Tabs
					value={activeTab}
					onChange={(_e, val) => setActiveTab(val)}
					textColor="primary"
					indicatorColor="primary"
				>
					<Tab label="Roll Sleep Session" />
					<Tab label="Split Optimizer" />
					<Tab label="Hunt Finder" />
				</Tabs>
			</Box>

			{/* Collapsible Target priorities section, only for tabs !== 0 */}
			{activeTab !== 0 && (
				<Box sx={{ mb: 3 }}>
					<Button
						variant="text"
						color="inherit"
						onClick={() => setTargetsExpanded(!targetsExpanded)}
						startIcon={
							targetsExpanded ? (
								<KeyboardArrowUpIcon />
							) : (
								<KeyboardArrowDownIcon />
							)
						}
						sx={{
							fontWeight: "bold",
							textTransform: "none",
							fontSize: "1rem",
							p: 0,
							mb: 1.5,
							color: "text.primary",
							"&:hover": { bgcolor: "transparent" },
						}}
					>
						Target Pokemon Priorities
					</Button>
					<Collapse in={targetsExpanded}>
						<Box sx={{ mt: 1 }}>
							{/* Targets Setup Section */}
							<Box
								sx={{
									display: "flex",
									gap: 1.5,
									mb: 2,
									flexWrap: "wrap",
									alignItems: "center",
								}}
							>
								{/* Custom Search Autocomplete */}
								<Box sx={{ position: "relative", width: "200px" }}>
									<TextField
										variant="standard"
										placeholder="Pokemon..."
										value={searchQuery}
										onChange={(e) => {
											setSearchQuery(e.target.value);
											setDropdownOpen(true);
											setHighlightedIdx(-1);
										}}
										onFocus={() => setDropdownOpen(true)}
										onBlur={() => {
											setTimeout(() => {
												setDropdownOpen(false);
												setHighlightedIdx(-1);
											}, 150);
										}}
										onKeyDown={handleInputKeyDown}
										fullWidth
									/>
									{dropdownOpen && filteredOptions.length > 0 && (
										<Box
											sx={{
												position: "absolute",
												top: "100%",
												left: 0,
												right: 0,
												bgcolor: "background.paper",
												boxShadow: 3,
												borderRadius: "4px",
												zIndex: 10,
												maxHeight: "220px",
												overflowY: "auto",
												border: "1px solid rgba(255, 255, 255, 0.1)",
												mt: "2px",
											}}
										>
											{filteredOptions.map((option, index) => {
												const isHighlighted = index === highlightedIdx;
												return (
													<Box
														key={option}
														onMouseDown={() => handleSelectOption(option)}
														onMouseEnter={() => setHighlightedIdx(index)}
														sx={{
															display: "flex",
															alignItems: "center",
															gap: "10px",
															p: "8px 12px",
															cursor: "pointer",
															bgcolor: isHighlighted
																? "rgba(255, 255, 255, 0.08)"
																: "transparent",
															"&:hover": {
																bgcolor: "rgba(255, 255, 255, 0.08)",
															},
														}}
													>
														<PokemonIcon
															idForm={getPokemonIdForm(option)}
															size={20}
														/>
														<Typography variant="body2">{option}</Typography>
													</Box>
												);
											})}
										</Box>
									)}
								</Box>

								{/* Custom Priority Slider */}
								<PrioritySlider
									value={selectedPriority}
									onChange={setSelectedPriority}
								/>

								<Button
									variant="contained"
									color="primary"
									size="small"
									onClick={handleAddTarget}
									sx={{ minWidth: "40px", height: "30px", ml: 2 }}
								>
									<AddIcon fontSize="small" />
								</Button>
							</Box>

							{/* Targets Priority Tier List */}
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									gap: "0.5rem",
									mb: 3,
								}}
							>
								{[5, 4, 3, 2, 1].map((tier) => {
									const tierTargets = targets.filter(
										(t) => t.catchPriority === tier,
									);

									return (
										<Box
											key={tier}
											onDragOver={(e) => {
												e.preventDefault();
												e.dataTransfer.dropEffect = "move";
											}}
											onDrop={(e) => {
												const pokemonName =
													e.dataTransfer.getData("pokemonName");
												if (pokemonName) {
													setTargets((prev) =>
														prev.map((t) =>
															t.pokemon === pokemonName
																? { ...t, catchPriority: tier }
																: t,
														),
													);
												}
											}}
											sx={{
												display: "flex",
												alignItems: "stretch",
												borderRadius: "6px",
												overflow: "hidden",
												background: "transparent",
												border: "1px solid",
												borderColor: "divider",
											}}
										>
											{/* Label */}
											<Box
												sx={{
													width: "50px",
													display: "flex",
													justifyContent: "center",
													alignItems: "center",
													fontWeight: "bold",
													fontSize: "1rem",
													color: "text.primary",
													textAlign: "center",
													p: "0.5rem",
													bgcolor: "action.hover",
													borderRight: "1px solid",
													borderColor: "divider",
													userSelect: "none",
												}}
											>
												{tier}
											</Box>
											{/* Drop Zone */}
											<Box
												sx={{
													flexGrow: 1,
													display: "flex",
													gap: "1rem",
													p: "0.5rem 1rem",
													flexWrap: "wrap",
													alignItems: "center",
													minHeight: "56px",
												}}
											>
												{tierTargets.length > 0 ? (
													tierTargets.map((t) => (
														<Box
															key={t.pokemon}
															draggable
															onDragStart={(e) => {
																e.dataTransfer.setData(
																	"pokemonName",
																	t.pokemon,
																);
																e.dataTransfer.effectAllowed = "move";
															}}
															onDragEnd={(e) => {
																if (e.dataTransfer.dropEffect === "none") {
																	handleRemoveTarget(t.pokemon);
																}
															}}
															sx={{
																position: "relative",
																cursor: "grab",
																"&:active": { cursor: "grabbing" },
																"&:hover .delete-badge": { opacity: 1 },
															}}
														>
															<PokemonIcon
																idForm={getPokemonIdForm(t.pokemon)}
																size={40}
															/>
															{/* absolute hover delete badge */}
															<Box
																className="delete-badge"
																onClick={(e) => {
																	e.stopPropagation();
																	handleRemoveTarget(t.pokemon);
																}}
																sx={{
																	position: "absolute",
																	top: "-4px",
																	right: "-4px",
																	width: "16px",
																	height: "16px",
																	borderRadius: "50%",
																	bgcolor: "#ff4b4b",
																	color: "#fff",
																	display: "flex",
																	alignItems: "center",
																	justifyContent: "center",
																	fontSize: "11px",
																	fontWeight: "bold",
																	cursor: "pointer",
																	boxShadow: "0px 1px 2px rgba(0,0,0,0.5)",
																	userSelect: "none",
																	opacity: 0,
																	transition: "opacity 0.15s ease",
																	zIndex: 2,
																	"&:hover": {
																		bgcolor: "#ff1a1a",
																	},
																}}
															>
																×
															</Box>
														</Box>
													))
												) : (
													<Typography
														variant="body2"
														sx={{
															color: "text.secondary",
															fontStyle: "italic",
															userSelect: "none",
														}}
													>
														Drag & drop target here
													</Typography>
												)}
											</Box>
										</Box>
									);
								})}
							</Box>
						</Box>
					</Collapse>
				</Box>
			)}

			{/* Tab panels */}
			{activeTab === 0 && (
				<Box>
					<Button
						variant="contained"
						color="primary"
						onClick={handleRunRollSession}
						disabled={isSimulating}
						sx={{ mb: 3 }}
					>
						Roll Sleep Session
					</Button>

					{sessionResult1 && (
						<Box>
							<Box
								sx={{ display: "flex", gap: "2rem", flexWrap: "wrap", mb: 3 }}
							>
								<Box className="stat-value">
									<Typography variant="caption" color="textSecondary">
										Session 1 Drowsy Power
									</Typography>
									<Typography variant="body1" fontWeight="bold">
										{sessionResult1.drowsyPower.toLocaleString()}
									</Typography>
								</Box>
								<Box className="stat-value">
									<Typography variant="caption" color="textSecondary">
										Session 1 Spawns
									</Typography>
									<Typography variant="body1" fontWeight="bold">
										{sessionResult1.spawnCount}
									</Typography>
								</Box>
								{sessionResult2 && (
									<>
										<Box className="stat-value">
											<Typography variant="caption" color="textSecondary">
												Session 2 Drowsy Power
											</Typography>
											<Typography variant="body1" fontWeight="bold">
												{sessionResult2.drowsyPower.toLocaleString()}
											</Typography>
										</Box>
										<Box className="stat-value">
											<Typography variant="caption" color="textSecondary">
												Session 2 Spawns
											</Typography>
											<Typography variant="body1" fontWeight="bold">
												{sessionResult2.spawnCount}
											</Typography>
										</Box>
									</>
								)}
							</Box>

							{/* Session 1 Rolls log */}
							<Typography variant="subtitle2" fontWeight="bold" gutterBottom>
								{sleepTwice ? "First Sleep Session Rolls:" : "Rolls log:"}
							</Typography>
							<TableContainer component={Box} sx={{ mb: 3 }}>
								<Table size="small">
									<TableHead>
										<TableRow>
											<TableCell>Roll</TableCell>
											<TableCell>Icon</TableCell>
											<TableCell>Pokemon</TableCell>
											<TableCell>Star</TableCell>
											<TableCell align="right">DPR Cost</TableCell>
											<TableCell align="right">Gauge Remaining</TableCell>
											<TableCell>Roll Rule Annotation</TableCell>
										</TableRow>
									</TableHead>
									<TableBody>
										{sessionResult1.rolls.map((r) => (
											<TableRow key={r.rollIndex}>
												<TableCell>{r.rollIndex}</TableCell>
												<TableCell>
													<PokemonIcon
														idForm={getPokemonIdForm(r.rolledStyle.pokemon)}
														size={28}
													/>
												</TableCell>
												<TableCell>{r.rolledStyle.pokemon}</TableCell>
												<TableCell>{r.rolledStyle.style}★</TableCell>
												<TableCell align="right">
													{r.rolledStyle.dpr.toLocaleString()}
												</TableCell>
												<TableCell align="right">
													{r.remainingGauge.toLocaleString()}
												</TableCell>
												<TableCell
													sx={{ color: "text.secondary", fontSize: "0.8rem" }}
												>
													{r.ruleApplied}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>

							{/* Session 2 Rolls log if split */}
							{sleepTwice && sessionResult2 && (
								<>
									<Typography
										variant="subtitle2"
										fontWeight="bold"
										gutterBottom
									>
										Second Sleep Session Rolls:
									</Typography>
									<TableContainer component={Box}>
										<Table size="small">
											<TableHead>
												<TableRow>
													<TableCell>Roll</TableCell>
													<TableCell>Icon</TableCell>
													<TableCell>Pokemon</TableCell>
													<TableCell>Star</TableCell>
													<TableCell align="right">DPR Cost</TableCell>
													<TableCell align="right">Gauge Remaining</TableCell>
													<TableCell>Roll Rule Annotation</TableCell>
												</TableRow>
											</TableHead>
											<TableBody>
												{sessionResult2.rolls.map((r) => (
													<TableRow key={r.rollIndex}>
														<TableCell>{r.rollIndex}</TableCell>
														<TableCell>
															<PokemonIcon
																idForm={getPokemonIdForm(r.rolledStyle.pokemon)}
																size={28}
															/>
														</TableCell>
														<TableCell>{r.rolledStyle.pokemon}</TableCell>
														<TableCell>{r.rolledStyle.style}★</TableCell>
														<TableCell align="right">
															{r.rolledStyle.dpr.toLocaleString()}
														</TableCell>
														<TableCell align="right">
															{r.remainingGauge.toLocaleString()}
														</TableCell>
														<TableCell
															sx={{
																color: "text.secondary",
																fontSize: "0.8rem",
															}}
														>
															{r.ruleApplied}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</TableContainer>
								</>
							)}
						</Box>
					)}
				</Box>
			)}

			{activeTab === 1 && (
				<Box>
					<Button
						variant="contained"
						color="primary"
						onClick={handleRunSplitOptimizer}
						disabled={isSimulating}
						sx={{ mb: 3 }}
					>
						{isSimulating ? "Optimizing..." : "Optimize Split"}
					</Button>

					{splitResults && (
						<TableContainer component={Box}>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Sleep Split Ratio (Main/Nap)</TableCell>
										<TableCell align="right">Session 1 Drowsy Power</TableCell>
										<TableCell align="right">Session 2 Drowsy Power</TableCell>
										<TableCell align="right">Expected Target Count</TableCell>
										<TableCell align="right">Expected Total Value</TableCell>
										<TableCell></TableCell> {/* Optimal Tag */}
									</TableRow>
								</TableHead>
								<TableBody>
									{(() => {
										const maxVal = Math.max(
											...splitResults.map((r) => r.expectedTotalValue),
										);
										return splitResults.map((row) => {
											const isOptimal =
												row.expectedTotalValue === maxVal && maxVal > 0;
											return (
												<TableRow
													key={row.splitRatio}
													sx={{
														backgroundColor: isOptimal
															? "rgba(76, 175, 80, 0.08)"
															: "inherit",
													}}
												>
													<TableCell sx={{ fontWeight: "bold" }}>
														{row.splitRatio}
													</TableCell>
													<TableCell align="right">
														{Math.round(row.drowsyPower1).toLocaleString()}
													</TableCell>
													<TableCell align="right">
														{Math.round(row.drowsyPower2).toLocaleString()}
													</TableCell>
													<TableCell align="right">
														{row.expectedTargetCount.toFixed(3)} (
														{row.expectedTargetCount1.toFixed(3)},{" "}
														{row.expectedTargetCount2.toFixed(3)})
													</TableCell>
													<TableCell
														align="right"
														sx={{
															fontWeight: isOptimal ? "bold" : "normal",
															color: isOptimal ? "#4caf50" : "inherit",
														}}
													>
														{row.expectedTotalValue.toFixed(2)} (
														{row.expectedTotalValue1.toFixed(2)},{" "}
														{row.expectedTotalValue2.toFixed(2)})
													</TableCell>
													<TableCell
														sx={{
															color: "#4caf50",
															fontWeight: "bold",
															fontSize: "0.8rem",
														}}
													>
														{isOptimal ? "Optimal" : ""}
													</TableCell>
												</TableRow>
											);
										});
									})()}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</Box>
			)}

			{activeTab === 2 && (
				<Box>
					<Box sx={{ mb: 3 }}>
						<Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
							Expected Snorlax Strength Per Day of the Week (Mon - Sun):
						</Typography>
						<Box
							sx={{
								display: "flex",
								flexWrap: "wrap",
								gap: "1rem",
								mb: 2,
								alignItems: "center",
							}}
						>
							<Box
								sx={{
									display: "flex",
									flexDirection: "column",
									width: "220px",
								}}
							>
								<Typography
									variant="caption"
									color="textSecondary"
									sx={{ mb: -0.5 }}
								>
									Average Snorlax strength per day
								</Typography>
								<NumericInput
									fullWidth
									value={averageStrength}
									onChange={handleAverageStrengthChange}
									min={0}
								/>
							</Box>
							<Button
								variant="contained"
								color="primary"
								onClick={handleRunHuntFinder}
								disabled={isSimulating}
							>
								{isSimulating ? "Finding..." : "Find Hunts"}
							</Button>
						</Box>
						<Box
							sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", mb: 2 }}
						>
							{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
								(day, idx) => (
									<Box
										key={day}
										sx={{
											display: "flex",
											flexDirection: "column",
											width: "80px",
										}}
									>
										<Typography
											variant="caption"
											color="textSecondary"
											sx={{ mb: -0.5 }}
										>
											{day}
										</Typography>
										<NumericInput
											fullWidth
											value={dailyStrengths[idx]}
											onChange={(val) => handleDailyStrengthChange(idx, val)}
											min={0}
										/>
									</Box>
								),
							)}
						</Box>
					</Box>

					{mapResults && (
						<TableContainer component={Box}>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell sx={{ width: "40px" }}></TableCell>
										<TableCell>Map Name</TableCell>
										<TableCell>Sleep Style</TableCell>
										<TableCell align="right">
											Expected Weekly Target Count
										</TableCell>
										<TableCell align="right">
											Expected Weekly Total Value
										</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{mapResults.map((row) => (
										<HuntFinderRow
											key={`${row.mapIndex}-${row.sleepType}`}
											row={row}
											getPokemonIdForm={getPokemonIdForm}
										/>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</Box>
			)}

			{simTimeMs !== null && (
				<Typography
					variant="caption"
					color="textSecondary"
					sx={{ display: "block", mt: 4 }}
				>
					Compute time: {simTimeMs.toFixed(2)}ms (10,000 Monte Carlo iterations)
				</Typography>
			)}
		</StyledWrapper>
	);
}

const StyledWrapper = styled("div")({
	padding: "1rem 0",
	"& .targets-container": {
		display: "flex",
		gap: "0.5rem",
		flexWrap: "wrap",
		marginTop: "0.5rem",
	},
	"& .target-pill": {
		display: "flex",
		alignItems: "center",
		gap: "0.5rem",
		padding: "0.2rem 0.5rem",
		borderRadius: "1rem",
		background: "rgba(255, 255, 255, 0.08)",
		border: "1px solid rgba(255, 255, 255, 0.1)",
	},
	"& .stat-value": {
		padding: "0.5rem 1rem",
		borderRadius: "4px",
		background: "rgba(255, 255, 255, 0.04)",
	},
});

const StyledForm = styled("div")({
	marginTop: ".8rem",
	display: "grid",
	gap: "0.8rem 1.2rem",
	gridTemplateColumns: "fit-content(200px) 1fr",
	alignItems: "center",

	"& .MuiInput-input:focus": {
		background: "inherit",
	},
});
