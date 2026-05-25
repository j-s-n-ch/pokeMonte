# PokeMonte: Simulation Tools for Pokémon Sleep

This tool is a fork of [Research Calc](https://nitoyon.github.io/pokesleep-tool/) that adds 3 tabs

### 1. Encounter Simulator
Simulates sleep session encounters (as far as we know) [Pokémon Sleep encounter rules](https://pks.raenonx.cc/en/docs/view/mechanics/rolling-sleep-styles-dpr).

### 2. Split Optimizer
Should you sleep once a day for a full score of 100, or split it into two sessions? Since species encounter chance is an emergent property of the complex sleep style rolling logic, this tool runs the simulation for 10k iterations to find the optimal two-session sleep split.

### 3. Hunt Finder
Plan your weekly research site! Fill out the tier list of Pokémon you want to catch and your projected daily Snorlax strength gains, and this tab will find which map and sleep style combination provides the best encounter coverage for your priority targets

---

## TO DO

*   Allow users to input their map area bonuses and account for this in the Hunt Finder optimization.
*   Allow optimizing for 2 sleep sessions in Hunt Finder.
*   Show projected dream shard yields (all 3 tabs).
*   Provide the option to weigh the value of the first sleep session heavier to account for the bonus biscuit.
*   Provide the option to use two sleep sessions that don't sum to 100.

---

## Local Development & Setup

Follow these steps to clone the project and run it locally on your computer:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) (v22.19 or higher) installed on your system.

### 1. Clone the Repository
Open your terminal and run:
```bash
git clone https://github.com/nitoyon/pokesleep-tool.git
cd pokesleep-tool
```

### 2. Install Dependencies
Install all required npm packages:
```bash
npm install
```

### 3. Setup Lefthook (Git Hooks)
Enable automated linting and formatting on git commits:
```bash
npx lefthook install
```

### 4. Run Development Server
Start the local development server:
```bash
npm run dev
```
The app will be available locally at `http://localhost:5173/` (or the port specified in your console). The page will reload automatically as you make changes.

### 5. Running Tests & Linters
To verify code correctness:
*   **Run unit tests**: `npm run test` (or `npx vitest` for interactive mode).
*   **Run types verification**: `npm run typecheck`.
*   **Run lint checks**: `npm run lint`.
*   **Full verification**: `TZ=UTC npm run verify` (runs typechecking, linting, unit tests, and production build).

---

## License

MIT
