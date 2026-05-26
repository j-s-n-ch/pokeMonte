import AddIcon from "@mui/icons-material/Add";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
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
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Typography,
	useTheme,
} from "@mui/material";
import { styled } from "@mui/system";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
	optimizeSingleSessionScore,
	optimizeSleepSplit,
	type SingleSessionOptimizeResult,
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
						{open ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
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
	const theme = useTheme();
	const isDarkMode = theme.palette.mode === "dark";
	const [isHovered, setIsHovered] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);

	const defaultLineColor = isDarkMode
		? "rgba(255, 255, 255, 0.7)"
		: "rgba(0, 0, 0, 0.42)";
	const hoverLineColor = isDarkMode
		? "rgba(255, 255, 255, 1)"
		: "rgba(0, 0, 0, 0.87)";
	const activeLineColor = theme.palette.primary.main;

	const handleDrag = useCallback(
		(clientX: number) => {
			if (!trackRef.current) return;
			const rect = trackRef.current.getBoundingClientRect();
			const clickX = clientX - rect.left;
			const width = rect.width;
			const pct = Math.max(0, Math.min(1, clickX / width));
			const rawVal = pct * 4 + 1;
			const stepVal = Math.round(rawVal);
			onChange(stepVal);
		},
		[onChange],
	);

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button !== 0) return;
		e.preventDefault();
		containerRef.current?.focus();
		setIsFocused(true);
		handleDrag(e.clientX);

		const handleMouseMove = (moveEvent: MouseEvent) => {
			handleDrag(moveEvent.clientX);
		};

		const handleMouseUp = () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
	};

	const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
		e.preventDefault();
		containerRef.current?.focus();
		setIsFocused(true);
		const touch = e.touches[0];
		handleDrag(touch.clientX);

		const handleTouchMove = (moveEvent: TouchEvent) => {
			const touch = moveEvent.touches[0];
			handleDrag(touch.clientX);
		};

		const handleTouchEnd = () => {
			window.removeEventListener("touchmove", handleTouchMove);
			window.removeEventListener("touchend", handleTouchEnd);
		};

		window.addEventListener("touchmove", handleTouchMove);
		window.addEventListener("touchend", handleTouchEnd);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "ArrowRight" || e.key === "ArrowUp") {
			onChange(Math.min(5, value + 1));
			e.preventDefault();
		} else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
			onChange(Math.max(1, value - 1));
			e.preventDefault();
		}
	};

	const steps = [1, 2, 3, 4, 5];

	return (
		<Box
			ref={containerRef}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			onFocus={() => setIsFocused(true)}
			onBlur={() => setIsFocused(false)}
			tabIndex={0}
			onKeyDown={handleKeyDown}
			sx={{
				width: "160px",
				ml: "32px",
				mr: "16px",
				display: "inline-flex",
				flexDirection: "column",
				verticalAlign: "middle",
				outline: "none",
				userSelect: "none",
			}}
		>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					mb: "2px",
				}}
			>
				<Typography
					variant="caption"
					sx={{ color: "text.secondary", fontSize: "0.7rem", lineHeight: 1 }}
				>
					1 (Low)
				</Typography>
				<Typography
					variant="caption"
					sx={{ color: "text.secondary", fontSize: "0.7rem", lineHeight: 1 }}
				>
					5 (High)
				</Typography>
			</Box>
			<Box
				ref={trackRef}
				onMouseDown={handleMouseDown}
				onTouchStart={handleTouchStart}
				sx={{
					position: "relative",
					height: "32px",
					display: "flex",
					alignItems: "center",
					cursor: "pointer",
				}}
			>
				{/* Base line */}
				<Box
					sx={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						height: "1px",
						bgcolor: isHovered ? hoverLineColor : defaultLineColor,
						transition:
							"background-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
					}}
				/>
				{/* Focus/Active line */}
				<Box
					sx={{
						position: "absolute",
						bottom: 0,
						left: 0,
						right: 0,
						height: "2px",
						bgcolor: activeLineColor,
						transform: isFocused ? "scaleX(1)" : "scaleX(0)",
						transformOrigin: "center",
						transition: "transform 200ms cubic-bezier(0.0, 0, 0.2, 1) 0ms",
					}}
				/>
				{steps.map((stepVal) => {
					const pct = ((stepVal - 1) / 4) * 100;
					return (
						<Box
							key={stepVal}
							sx={{
								position: "absolute",
								bottom: 0,
								left: `${pct}%`,
								transform: "translate(-50%, 50%)",
								width: "4px",
								height: "4px",
								borderRadius: "50%",
								bgcolor: isDarkMode ? "#121212" : "#fff",
								border: `1px solid ${
									isFocused
										? activeLineColor
										: isHovered
											? hoverLineColor
											: defaultLineColor
								}`,
								zIndex: 1,
								transition:
									"border-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
							}}
						/>
					);
				})}
				<Box
					sx={{
						position: "absolute",
						bottom: 0,
						left: `${((value - 1) / 4) * 100}%`,
						transform: "translate(-50%, 50%)",
						width: "12px",
						height: "12px",
						borderRadius: "50%",
						bgcolor: isDarkMode ? "#90caf9" : "primary.main",
						boxShadow: isFocused
							? `0 0 0 4px ${theme.palette.primary.main}33`
							: "none",
						zIndex: 2,
						transition: "left 0.15s ease, box-shadow 0.15s",
					}}
				/>
			</Box>
		</Box>
	);
}

function CustomSearchInput({
	value,
	onChange,
	onFocus,
	onBlur,
	onKeyDown,
	placeholder,
}: {
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onFocus: () => void;
	onBlur: () => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
	placeholder: string;
}) {
	const theme = useTheme();
	const isDarkMode = theme.palette.mode === "dark";
	const [isHovered, setIsHovered] = useState(false);
	const [isFocused, setIsFocused] = useState(false);

	const defaultLineColor = isDarkMode
		? "rgba(255, 255, 255, 0.7)"
		: "rgba(0, 0, 0, 0.42)";
	const hoverLineColor = isDarkMode
		? "rgba(255, 255, 255, 1)"
		: "rgba(0, 0, 0, 0.87)";
	const activeLineColor = theme.palette.primary.main;

	return (
		<Box
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			sx={{
				position: "relative",
				width: "200px",
				height: "32px",
				display: "inline-flex",
				alignItems: "center",
			}}
		>
			<input
				type="text"
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				onFocus={() => {
					setIsFocused(true);
					onFocus();
				}}
				onBlur={() => {
					setIsFocused(false);
					onBlur();
				}}
				onKeyDown={onKeyDown}
				style={{
					width: "100%",
					height: "100%",
					border: "none",
					outline: "none",
					background: "transparent",
					color: isDarkMode ? "#fff" : "rgba(0, 0, 0, 0.87)",
					fontFamily: theme.typography.fontFamily,
					fontSize: "0.875rem",
					padding: "4px 0",
				}}
			/>
			{/* Base line */}
			<Box
				sx={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					height: "1px",
					bgcolor: isHovered ? hoverLineColor : defaultLineColor,
					transition: "background-color 200ms cubic-bezier(0.4, 0, 0.2, 1) 0ms",
				}}
			/>
			{/* Focus/Active line */}
			<Box
				sx={{
					position: "absolute",
					bottom: 0,
					left: 0,
					right: 0,
					height: "2px",
					bgcolor: activeLineColor,
					transform: isFocused ? "scaleX(1)" : "scaleX(0)",
					transformOrigin: "center",
					transition: "transform 200ms cubic-bezier(0.0, 0, 0.2, 1) 0ms",
				}}
			/>
		</Box>
	);
}

export default function EncounterSimulatorTab({
	activeTab,
}: {
	activeTab: number;
}) {
	const theme = useTheme();
	const isDarkMode = theme.palette.mode === "dark";
	const baseColor = isDarkMode ? "255, 255, 255" : "0, 0, 0";
	const labelBgColors: Record<number, string> = {
		5: `rgba(${baseColor}, 0.16)`,
		4: `rgba(${baseColor}, 0.12)`,
		3: `rgba(${baseColor}, 0.08)`,
		2: `rgba(${baseColor}, 0.05)`,
		1: `rgba(${baseColor}, 0.02)`,
	};

	const primaryButtonSx = {
		bgcolor: isDarkMode ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
		color: "primary.main",
		fontWeight: "bold",
		textTransform: "none",
		boxShadow: "none",
		"&:hover": {
			bgcolor: isDarkMode ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)",
			boxShadow: "none",
		},
		"&.Mui-disabled": {
			color: "action.disabled",
			bgcolor: "action.disabledBackground",
		},
	};

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
	const [selectedPriority, setSelectedPriority] = useState<number>(3);

	const pokemonOptions = useMemo(() => {
		const names = pokemons.map((p) => p.name);
		return Array.from(new Set(names)).sort();
	}, []);

	// Drag and drop tracking refs (to delete on release outside without snapback delay)
	const draggedPokemonRef = useRef<string | null>(null);
	const droppedInZoneRef = useRef<boolean>(false);

	useEffect(() => {
		const handleGlobalDragOver = (e: DragEvent) => {
			e.preventDefault();
		};
		window.addEventListener("dragover", handleGlobalDragOver);
		return () => {
			window.removeEventListener("dragover", handleGlobalDragOver);
		};
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
			if (filteredOptions.length > 0) {
				const targetIdx = highlightedIdx !== -1 ? highlightedIdx : 0;
				const pokemonName = filteredOptions[targetIdx];
				setTargets((prev) => {
					if (
						prev.some(
							(t) => t.pokemon.toLowerCase() === pokemonName.toLowerCase(),
						)
					) {
						return prev;
					}
					return [
						...prev,
						{ pokemon: pokemonName, catchPriority: selectedPriority },
					];
				});
				setSearchQuery("");
				setDropdownOpen(false);
				setHighlightedIdx(-1);
			}
		} else if (e.key === "Escape") {
			setDropdownOpen(false);
			setHighlightedIdx(-1);
		}
	};

	const handleSelectOption = (option: string) => {
		setTargets((prev) => {
			if (prev.some((t) => t.pokemon.toLowerCase() === option.toLowerCase())) {
				return prev;
			}
			return [...prev, { pokemon: option, catchPriority: selectedPriority }];
		});
		setSearchQuery("");
		setDropdownOpen(false);
		setHighlightedIdx(-1);
	};

	// Tabs state
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
	const [singleSessionOptimal, setSingleSessionOptimal] =
		useState<SingleSessionOptimizeResult | null>(null);
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

	const getPokemonSleepType = useCallback((name: string) => {
		const found = pokemons.find(
			(p) => p.name.toLowerCase() === name.toLowerCase(),
		);
		return found ? found.sleepType : "dozing";
	}, []);

	const handleAddTarget = useCallback(() => {
		const queryName = searchQuery.trim();
		if (!queryName) return;

		const exactMatch = pokemonOptions.find(
			(name) => name.toLowerCase() === queryName.toLowerCase(),
		);
		const pokemonName =
			exactMatch || (filteredOptions.length > 0 ? filteredOptions[0] : null);

		if (!pokemonName) return;

		setTargets((prev) => {
			if (
				prev.some((t) => t.pokemon.toLowerCase() === pokemonName.toLowerCase())
			) {
				return prev;
			}
			return [
				...prev,
				{ pokemon: pokemonName, catchPriority: selectedPriority },
			];
		});
		setSearchQuery("");
		setDropdownOpen(false);
		setHighlightedIdx(-1);
	}, [searchQuery, filteredOptions, selectedPriority, pokemonOptions]);

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

				const singleRes = optimizeSingleSessionScore(
					fieldIndex,
					sleepType,
					snorlaxPower * bonus,
					targets,
					10000,
				);
				setSingleSessionOptimal(singleRes);
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
			{(activeTab === 0 || activeTab === 1) && (
				<>
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
							<NumericInput
								value={snorlaxPower}
								onChange={setSnorlaxPower}
								min={0}
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

						{activeTab === 0 && (
							<>
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
							</>
						)}
					</StyledForm>

					<Divider sx={{ my: 3 }} />
				</>
			)}

			{/* Collapsible Target priorities section, only for tabs !== 0 */}
			{activeTab !== 0 && (
				<Box sx={{ mb: 3 }}>
					<Button
						variant="text"
						color="inherit"
						onClick={() => setTargetsExpanded(!targetsExpanded)}
						startIcon={
							targetsExpanded ? (
								<KeyboardArrowDownIcon />
							) : (
								<KeyboardArrowRightIcon />
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
									alignItems: "flex-end",
								}}
							>
								{/* Custom Search Autocomplete */}
								<Box sx={{ position: "relative", width: "200px" }}>
									<CustomSearchInput
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
									size="small"
									onClick={handleAddTarget}
									sx={{
										...primaryButtonSx,
										minWidth: "40px",
										height: "30px",
										ml: 2,
									}}
								>
									<AddIcon fontSize="small" />
								</Button>
							</Box>

							{/* Targets Priority Tier List */}
							{/* Columns Headers */}
							<Box
								sx={{
									display: "grid",
									gridTemplateColumns: "50px 1fr 1fr 1fr",
									gap: "0.5rem",
									mb: "0.25rem",
									alignItems: "center",
								}}
							>
								<Box sx={{ width: "50px" }} />
								{(["dozing", "snoozing", "slumbering"] as const).map((type) => (
									<Typography
										key={type}
										variant="caption"
										sx={{
											fontSize: "0.75rem",
											fontWeight: "bold",
											color: "text.secondary",
											textTransform: "uppercase",
											userSelect: "none",
											pl: "0.5rem",
										}}
									>
										{type}
									</Typography>
								))}
							</Box>

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
											sx={{
												display: "grid",
												gridTemplateColumns: "50px 1fr 1fr 1fr",
												gap: "0.5rem",
												alignItems: "stretch",
												background: "transparent",
												borderRadius: "6px",
												bgcolor: isDarkMode
													? "rgba(255, 255, 255, 0.02)"
													: "rgba(0, 0, 0, 0.01)",
												overflow: "hidden",
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
													bgcolor: labelBgColors[tier],
													userSelect: "none",
												}}
											>
												{tier}
											</Box>

											{/* Columns */}
											{(["dozing", "snoozing", "slumbering"] as const).map(
												(type, idx) => {
													const typeTargets = tierTargets.filter(
														(t) => getPokemonSleepType(t.pokemon) === type,
													);
													return (
														<Box
															key={type}
															onDragOver={(e) => {
																e.preventDefault();
																e.dataTransfer.dropEffect = "move";
															}}
															onDrop={(e) => {
																droppedInZoneRef.current = true;
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
																gap: "0.5rem 0.75rem",
																p: "0.5rem",
																flexWrap: "wrap",
																alignItems: "center",
																justifyContent: "flex-start",
																minHeight: "56px",
																borderRight: idx < 2 ? "1px solid" : "none",
																borderColor: "divider",
															}}
														>
															{typeTargets.map((t) => (
																<Box
																	key={t.pokemon}
																	draggable
																	onDragStart={(e) => {
																		draggedPokemonRef.current = t.pokemon;
																		droppedInZoneRef.current = false;
																		e.dataTransfer.setData(
																			"pokemonName",
																			t.pokemon,
																		);
																		e.dataTransfer.effectAllowed = "move";
																	}}
																	onDragEnd={(e) => {
																		if (
																			!droppedInZoneRef.current &&
																			draggedPokemonRef.current &&
																			e.dataTransfer.dropEffect !== "none"
																		) {
																			handleRemoveTarget(
																				draggedPokemonRef.current,
																			);
																		}
																		draggedPokemonRef.current = null;
																	}}
																	sx={{
																		position: "relative",
																		cursor: "grab",
																		"&:active": {
																			cursor: "grabbing",
																		},
																		"&:hover .delete-badge": {
																			opacity: 1,
																		},
																	}}
																>
																	<PokemonIcon
																		idForm={getPokemonIdForm(t.pokemon)}
																		size={48}
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
															))}
														</Box>
													);
												},
											)}
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
						onClick={handleRunRollSession}
						disabled={isSimulating}
						sx={{
							...primaryButtonSx,
							mb: 3,
						}}
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
						onClick={handleRunSplitOptimizer}
						disabled={isSimulating}
						sx={{
							...primaryButtonSx,
							mb: 3,
						}}
					>
						{isSimulating ? "Optimizing..." : "Optimize Split"}
					</Button>

					{singleSessionOptimal && (
						<Box
							sx={{
								mb: 3,
								p: "1rem 1.5rem",
								borderRadius: "6px",
								bgcolor: isDarkMode
									? "rgba(144, 202, 249, 0.08)"
									: "rgba(25, 118, 210, 0.04)",
								border: "1px solid",
								borderColor: isDarkMode
									? "rgba(144, 202, 249, 0.2)"
									: "rgba(25, 118, 210, 0.1)",
							}}
						>
							<Typography
								variant="subtitle1"
								sx={{ fontWeight: "bold", mb: 1, color: "primary.main" }}
							>
								Optimal Single Sleep Session
							</Typography>
							<Typography variant="body2" sx={{ color: "text.primary" }}>
								For a single sleep session, the optimal Drowsy Power is{" "}
								<strong>
									{Math.round(
										singleSessionOptimal.drowsyPower,
									).toLocaleString()}
								</strong>{" "}
								(corresponding to a Sleep Score of{" "}
								<strong>{singleSessionOptimal.score}</strong>).
							</Typography>
							<Typography
								variant="body2"
								sx={{ color: "text.secondary", mt: 0.5 }}
							>
								Expected target encounters:{" "}
								<strong>
									{singleSessionOptimal.expectedTargetCount.toFixed(3)}
								</strong>{" "}
								| Expected target value:{" "}
								<strong>
									{singleSessionOptimal.expectedTotalValue.toFixed(2)}
								</strong>
								.
							</Typography>
						</Box>
					)}

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
								onClick={handleRunHuntFinder}
								disabled={isSimulating}
								sx={primaryButtonSx}
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
