# Nutrition and statistics implementation plan

> Execution: native in the current isolated checkout; whole-change independent review after verification.

**Goal:** Add four-meal nutrition tracking, weight/nutrient/workout trends and backwards-compatible import.

**Architecture:** Preserve the existing workout data and UI. Add pure core, data/provider module and integrated screens with an independent versioned life store. No backend or API secrets.

**Tech Stack:** Vanilla JS, HTML, CSS, Node test runner, Playwright for browser verification.

**Spec:** docs/superpowers/specs/2026-11-14-nutrition-statistics-design.md

## Global constraints
- Russian mobile interface; no personal journal data in git.
- Preserve moyput_workouts_v1; read old JSON and CSV; copy v2 includes both stores.
- Missing nutrient is unknown, not zero; units explicit; goals editable.
- Four meal IDs breakfast/lunch/snack/dinner. Food history stores nutrient snapshots.
- Personal goals are imported privately or entered locally; public source defaults are unset. Preserve optional private goal notes.

## Review focus
- Incomplete and malformed imports must never delete existing data or partially commit.
- Repeated imports and partial-session conflicts must not duplicate or overwrite current completed sets.
- Correct mineral/vitamin scaling and absence propagation across products/days.
- Empty dates, zero starting weights and changes in repetitions must not produce misleading percentages.
- Mobile controls, reload, storage-full errors and offline database availability.

### Task 1: Core, migration and persistence
Files: tracker-core.js, tests/core.test.cjs, package.json.
Interfaces: TrackerCore provides nutrient metadata/goals, totals(entries), parseWorkoutCSV(text, workouts), parseBackup(text, workouts), mergeWorkouts(existing,incoming), weightSeries(workouts,life,start,end), workoutSeries(sessions, exerciseId,start,end), dailySeries(life,key,start,end), persistImport(storage,workouts,life).
- [ ] Write failing tests for portion scaling/missing data, CSV quote parsing/invalid values, merge idempotence and conflicts, date filtering/zero baselines, persistence failure.
- [ ] Implement and run node --test tests/core.test.cjs; expect all pass.
- [ ] Verify actual attached CSV through environment-provided file path; commit code only.

### Task 2: Product catalog and search
Files: food-provider.js, foods/*, scripts/build-food-catalog.py, tests/food.test.cjs, SOURCES.md.
Interfaces: FoodProvider.searchLocal(query), searchRemote(query), fromOFF(product) => normalized per-100g Food; ensureCatalog() async loads local index.
- [ ] Test Open Food Facts unit conversion, unavailable nutrients and rejected per-100ml entries; run RED.
- [ ] Build documented USDA catalog from official archive, preserving nulls; add Russian names/search terms for common ingredients.
- [ ] Implement online search with explicit trigger, bounded requests and failure feedback; run unit tests and live request check.

### Task 3: Nutrition, statistics, backups and integration
Files: life-ui.js, life.css, app.js, index.html, sw.js, manifest.webmanifest, README.txt, tests/browser.cjs.
Interfaces: LifeUI.init({workouts,getWorkoutDb,setWorkoutDb,render,toast,download}); renderNutrition(), renderAnalytics(), renderData(); actions have separate data-life attributes.
- [ ] Write browser scenario for CSV preview/import, adding food/grams to four meals, goal editing, graph filters, backup roundtrip/reload, old-workout preservation; run RED.
- [ ] Implement forms, meal totals, nutrient bars, chart/table, range controls, weight input, goals, product snapshots and import preview.
- [ ] Update offline shell and asset cache; check mobile 375px and desktop layouts, keyboard and offline reload.
- [ ] Run complete unit and browser checks; commit.

### Task 4: Review and delivery
- [ ] Fresh review of the full diff; address significant issues and re-run affected checks.
- [ ] Publish code in a feature branch and create a PR with concise validation and known data coverage limits.
- [ ] Supply repository result and exact CSV-import/update steps.
