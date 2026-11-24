# codex-tooling review

Read-only audit of tooling, tests, examples, documentation generation, the documentation site, and publishing. Findings are ranked by expected payoff relative to effort. No repository files were changed; no build, install, generation-to-disk, API update, or full test run was performed.

Evidence collected:

- Read AGENTS.md and CONTRIBUTING.md first, both workflows, all seven scripts, the relevant site code, the documentation tests, shared browser helpers, both reported flaky tests and their implementation paths, and selected browser/performance/package tests.
- The supplied /tmp/vellum-baseline-check.log ends with exit=1. It reports two Node test timeouts, browser provider/matcher errors, and an iframe readiness timeout. The provider/matcher initialization failure's root cause is **uncertain**; this review does not attribute it to application code or recommend replacing expect.element blindly. The two previously reported flakes below are diagnosed from code, not claimed as reproduced by this baseline.
- pnpm docs:check passed. An additional read-only in-memory generate() measurement produced 370 files, 104 components, and zero documentation problems: 184 ms to import the tooling and 2,302 ms to generate on this machine. This is one local observation, not a CI benchmark.
- An isolated compiler/inliner probe, using the actual functions read from scripts/docs.ts and virtual source files, reproduced an unresolved import alias. Its input, output, and compiler diagnostic are in /tmp/vellum-review/codex-tooling/docs-alias-probe.json.
- Final git status --short was empty.

### CT01 Run the quality gate before a release tag is pushed
- Where: .github/workflows/release.yml:3, .github/workflows/release.yml:54, .github/workflows/pages.yml:7, .github/workflows/pages.yml:46
- Kind: dx
- Impact: high — the repository currently discovers CI-only test and API failures during release, while ordinary main pushes only verify documentation and build the site.
- Effort: S (<1h)
- Breaking: no
- Proposal: Add a pull_request and main-push validation workflow that runs the existing pnpm check with Node 24, the locked pnpm version, and the same Chromium setup as release. Reuse setup steps where practical. Keep publication exclusively on the existing stable v* tag workflow, including its main-ancestry and manifest-version checks; do not make PR validation publish anything.
- Evidence: Enumerated .github/workflows/: only release.yml and pages.yml exist. Release runs pnpm check only for v* tags; Pages runs docs:check and site:build, with no tests, lint, typecheck, or API check. The supplied failing baseline demonstrates why discovering failures earlier has practical value.

### CT02 Make CommandPalette debounce and cancellation tests deterministic
- Where: test/browser/command-palette.browser.test.tsx:180, test/browser/command-palette.browser.test.tsx:192, src/components/CommandPalette.tsx:25, src/components/CommandPalette.tsx:175, src/components/CommandPalette.tsx:195
- Kind: flaky
- Impact: medium — a valid search for the intermediate query can fail the test on a slow runner, and the current test never exercises a genuinely pending stale response.
- Effort: S (<1h)
- Breaking: no
- Proposal: Separate browser integration from debounce scheduling. In the integration test, fill one final query and wait for that query's result instead of assuming two browser commands share one 150 ms window. Verify debounce with controlled input events and a controlled clock, outside Playwright command latency; the existing helper notes that userEvent can advance fake time, so merely enabling fake timers around the same commands is insufficient. For cancellation, return deferred promises, wait until the first request has actually started, change the query, assert its signal was aborted, then resolve the newer and older requests in reverse order and verify only the newer results appear. Include closing/unmounting with an outstanding request.
- Evidence: Two awaited userEvent.fill calls precede an exact call-count assertion of 1 and an expectation that calls[0].query is se. The implementation legitimately calls onSearch for s if the second command arrives more than 150 ms later. Promise.resolve in the mock means the first search has already completed before the abort assertion, so removing the stale-response guard could escape this test. The actual contribution of transport delay to a particular past CI run is **uncertain**, but the race in the test is explicit.

### CT03 Stop treating reduced-motion correctness as a 100 ms performance budget
- Where: test/browser/charts-motion.browser.test.tsx:41, test/browser/charts-motion.browser.test.tsx:95, test/browser/charts-motion.browser.test.tsx:101, test/browser/charts-motion.browser.test.tsx:117, src/components/charts/engine.tsx:222, src/components/charts/engine.tsx:250, vitest.config.ts:76
- Kind: flaky
- Impact: medium — correct reduced-motion behavior can fail when CI delays rendering or MutationObserver delivery; batched observer records can also create misleading durations.
- Effort: S (<1h)
- Breaking: no
- Proposal: Keep functional assertions that the live ECharts option changes immediately to animation=false and update duration 0, that the intended legend update completes, and that enabling motion restores the option. Wait for the corresponding completion/state with a generous timeout; remove the greater-than-150 and less-than-100 wall-clock assertions from this functional suite. If actual latency remains a requirement, measure it in the existing serial perf project. Any retained observer should disconnect in finally. A separate serial motion project is appropriate for tests that must sample real animation, rather than disabling parallelism for all browser tests.
- Evidence: updateDuration timestamps callback delivery with one performance.now() value for every record in a MutationObserver batch; those are not mutation timestamps. CPU scheduling can lengthen the interval or place both mutations in one batch. The engine itself sets animation options and toggles data-rendered on finished, so both functional facts are observable without a 100 ms limit. The normal browser project has no serial scheduling setting, while vitest.perf.config.ts:21 already serializes performance files. The precise cause of any particular historical failure remains **uncertain** without that failure's trace.

### CT04 Keep dependency startup outside the five-second assertion budget
- Where: test/guards.test.ts:71, test/tokens.test.ts:266, src/theme/antd.ts:9, vitest.config.ts:64
- Kind: flaky
- Impact: medium — simple theme assertions currently fail because their test bodies also pay for loading the large Ant Design dependency graph.
- Effort: S (<1h)
- Breaking: no
- Proposal: Move these dependency imports to module setup, or one beforeAll with an explicit setup timeout, and leave the assertion bodies synchronous. Bound Node worker concurrency if startup contention remains measurable; do not globally increase every test timeout. A focused theme-adapter suite can share this startup rather than paying it inside unrelated guard tests.
- Evidence: The completed baseline names exactly these two tests as five-second timeouts, reporting approximately 16.7 s and 12.3 s for the failed bodies. Both import Ant Design directly or via src/theme/antd.ts inside the timed test. No assertion mismatch is reported. The relative contributions of Vite transformation, dependency loading, and host contention are **uncertain**, but startup is unambiguously inside the assertion timeout today.

### CT05 Smoke-test the packed package as a consumer before publishing
- Where: scripts/build.ts:54, scripts/build.ts:73, scripts/build.ts:81, scripts/release.ts:35, test/release.test.ts:18, package.json:37, package.json:64, .github/workflows/release.yml:57
- Kind: test-gap
- Impact: high — the irreversible release gate validates filenames and manifest entries but does not prove that the emitted JavaScript and declarations can be consumed.
- Effort: M (half a day)
- Breaking: no
- Proposal: After the existing pnpm pack and tarball extraction, run a small consumer fixture against that exact artifact. Type-check representative imports under NodeNext and bundler resolution, bundle/render a small component with the published stylesheet, and traverse emitted relative imports and lazy chunks for missing targets. Include a lazy chart or Markdown entry. Run this package smoke check in non-publishing CI too. Preserve the same checked tarball for publication; never rebuild in the credentialed job.
- Evidence: Source tests resolve the package to src/index.ts, whereas publishConfig changes it to dist/index.js. build.ts preserves modules and separately emits/rewrites declaration imports. checkPacked only checks a short fixed list of files, so a missing nested JS module, lazy chunk, or declaration target can pass it. release.test.ts tests a synthetic manifest and Set of filenames; npm publish --dry-run does not load or type-check the package. No broken current artifact is claimed, and no build was run during this review.

### CT06 Remove a real-time sleep that can change Reasoning's expected label
- Where: test/browser/reasoning-tools.browser.test.tsx:86, src/components/ai/Reasoning.tsx:80, src/components/ai/duration.ts:11
- Kind: flaky
- Impact: medium — one test always waits at least 1.6 seconds and can expect the wrong rounded duration after a CI scheduling pause.
- Effort: S (<1h)
- Breaking: no
- Proposal: Control Date.now for this duration-measurement test, advancing it by exactly 1,600 ms between the thinking and completed renders; restore the mock in finally. Alternatively use the existing controlled-clock tools with explicit time points. Keep the DOM and label assertion, but remove the real sleep. Use condition-based waits for unrelated layout checks such as test/browser/form.browser.test.tsx:129 instead of a fixed extra 400 ms.
- Evidence: setTimeout(1600) guarantees a minimum delay, not an exact elapsed time. The component measures Date.now(), and formatDuration rounds to the nearest second; a delay beyond 2.5 s legitimately produces 3s while the test waits for exactly Thought for 2s. This is a code-proven scheduling vulnerability, not a failure observed in the supplied baseline.

### CT07 Give frame helpers explicit semantics and restore the intended perf workload
- Where: test/browser/render.tsx:271, test/browser/motion.browser.test.tsx:38, test/browser/dialogs.browser.test.tsx:339, test/browser/data-table-virtual.browser.test.tsx:61, test/browser/perf/chat-perf.browser.test.tsx:145, test/browser/perf/data-table-perf.browser.test.tsx:160
- Kind: test-gap
- Impact: medium — scrolling performance tests apply updates every two animation frames while claiming to exercise updates every frame, reducing the workload and obscuring regressions.
- Effort: M (half a day)
- Breaking: no
- Proposal: Define one shared animationFrame helper for one requestAnimationFrame, a separately named afterPaint/settle helper for two frames, and frames(n) based on the single-frame primitive. Update scroll drivers to schedule 120 px on every frame, and use the settle helper only for stabilization. Consolidate duplicated sampling and long-task collection helpers, with explicit observer cleanup and takeRecords when stopping. Do not mechanically replace legitimate animation sampling with sleeps.
- Evidence: render.tsx's nextFrame nests two requestAnimationFrame calls. Both perf scroll loops await that helper once per update even though their file headers specify 120 px per frame; at 60 Hz they apply about 30 updates/s. Motion and dialog tests separately define single-frame sampling, and several other files duplicate multi-frame loops. The mismatch is visible in source; production performance was not benchmarked here.

### CT08 Generate and validate repository documentation once per quality-gate run
- Where: package.json:95, test/docs.test.ts:26, test/docs.test.ts:235, test/docs.test.ts:374, scripts/docs-gen.ts:11, scripts/docs-gen.ts:13, scripts/docs.ts:111
- Kind: perf
- Impact: medium — every successful pnpm check rebuilds the documentation compiler/model twice and repeats the same generated-file freshness scan.
- Effort: M (half a day)
- Breaking: no
- Proposal: Give documentation validation one owner: a dedicated docs test project or a shared verification entry point invoked once by docs:check. Keep all current checks, including standalone snippet compilation and link/anchor checks. Remove duplicated whole-repository generation and freshness validation from the general Node run, while retaining small fixture-based generator tests there. Make test:node, test:browser, and watch commands explicit using the existing project selectors; run the expensive docs project separately so it does not compete with browser animation tests. Keep pnpm check as the single complete gate.
- Evidence: test/docs.test.ts generates the complete model during suite collection, then compiles all copied examples in another TypeScript Program and scans the output files. After pnpm test succeeds, package.json invokes docs:check, whose CLI generates and scans them again. Local read-only generation cost 2.3 s for 370 outputs, excluding standalone snippet compilation. Importantly, compiling copyable snippets is valuable additional coverage and should not be removed as though ordinary typecheck covered it.

### CT09 Add a small WebKit compatibility project for the actual consumer runtime
- Where: AGENTS.md:15, vitest.config.ts:45, vitest.config.ts:48, .github/workflows/release.yml:48, src/components/overlays.module.css:81, src/components/file-preview/file-preview.module.css:64, src/base.css:922
- Kind: test-gap
- Impact: high — all browser validation uses Chromium despite WebKitGTK being the primary desktop runtime, leaving engine-specific motion, focus, and layout behavior unchecked.
- Effort: M (half a day)
- Breaking: no
- Proposal: Add a focused Playwright WebKit project covering Drawer entry/interruption, FilePreview opening/closing, nested overlay focus, virtualized scrolling, and reduced-motion behavior. Give it its own launch configuration rather than the Chromium executablePath, and use a provider-neutral media-emulation command for shared tests instead of cdp(). Keep Chromium as the main broad suite. Record the minimum supported WebKitGTK version and add a small real Tauri/WebKitGTK smoke run when practical; Playwright WebKit is useful coverage, not proof for every deployed GTK build.
- Evidence: The only configured instance is chromium, and release installs only Chromium. Drawer and FilePreview depend on @starting-style, while base.css contains an explicit linear() fallback that the normal modern-Chromium run cannot exercise. No WebKit failure is asserted; compatibility on supported GTK versions is **uncertain** until tested. The motion test's CDP import at test/browser/charts-motion.browser.test.tsx:8 is also a concrete obstacle to simply adding another instance to the existing project.

### CT10 Preserve imported aliases when inlining copyable examples
- Where: scripts/docs.ts:663, scripts/docs.ts:674, scripts/docs.ts:698, test/docs.test.ts:235
- Kind: bug
- Impact: medium — valid example source can produce non-compiling copied documentation when a local helper import is renamed.
- Effort: M (half a day)
- Breaking: no
- Proposal: Move helper inlining into a fixture-testable module and preserve bindings when flattening imports. Rename references with symbol-aware AST transforms, or introduce a correctly ordered alias binding, checking for name collisions. Add focused cases for renamed named/default imports, two helpers with colliding declaration names, shorthand properties, and recursive helper dependencies. Retain the full-corpus copy-compilation test as integration coverage.
- Evidence: Using the exact inlining functions from scripts/docs.ts, a virtual example importing value as renamed from helper.ts generated const value = 42 followed by export function Basic() { return renamed }. TypeScript reported Cannot find name 'renamed'. The original import is discarded at the helper branch and the helper declaration is copied verbatim; no binding rewrite occurs. The existing corpus passes docs:check, and this probe does not claim an already published example uses the failing alias pattern. Full reproduction: /tmp/vellum-review/codex-tooling/docs-alias-probe.json.

### CT11 Generate site metadata directly and lazy-load full documentation content
- Where: site/content.ts:12, site/content.ts:30, site/content.ts:94, site/content.ts:118, site/pages/ComponentPage.tsx:92, scripts/docs.ts:1469, scripts/docs.ts:1893
- Kind: perf
- Impact: medium — opening any docs route imports every component's full bilingual data and both languages of all non-component Markdown, including pages and code the visitor never opens.
- Effort: M (half a day)
- Breaking: no
- Proposal: Generate a compact site manifest with page order, localized titles/summaries, headings, recipe level, and component search metadata from the existing collected model. Load component details and Markdown by route/language, and example code on demand when appropriate. Use manifest fields instead of parsing English overview prose for ordering and recipe difficulty. Keep the public components.json output and its types available unchanged; the site can use an additional internal format.
- Evidence: Measured source inputs are 1,149,512 bytes for components.json and 1,176,114 bytes for 62 eagerly imported Markdown pages. These are raw source sizes, not production transfer measurements. Example modules are already lazy, but their documentation code is eagerly imported even though ComponentPage only shows it after Show code. folder() reparses Markdown links, and recipeLevels recognizes literal headings ### Basic, ### Advanced, and ### Scenarios even though the generator already has RecipeDoc.level. Actual production bundle-size and latency gains are **uncertain** until measured; the eager dependency and presentation-to-metadata coupling are explicit.

### CT12 Split docs.ts at the extraction/model/rendering boundaries
- Where: scripts/docs.ts:111, scripts/docs.ts:459, scripts/docs.ts:635, scripts/docs.ts:922, scripts/docs.ts:1074, scripts/docs.ts:1311, scripts/docs.ts:1416, scripts/docs.ts:1482, scripts/docs.ts:1868, test/docs.test.ts:26
- Kind: refactor
- Impact: medium — compiler traversal, snippet dependency resolution, validation, translations, and four output formats are coupled to one fixed repository root, making localized changes expensive to verify.
- Effort: L (days)
- Breaking: no
- Proposal: Keep docs.ts as a small facade/orchestrator. Extract compiler/program configuration, TSDoc/type extraction, example inlining, guide/recipe loading, bilingual validation/catalogs, and pure Markdown/Storybook/JSON/llms renderers into cohesive modules. Pass a root or virtual compiler host to extraction and pass the existing serializable model to renderers. Share one stale-file comparison function between checking and generation. Preserve generated outputs in the first stage, then add small positive/negative fixtures for union modes, static members, inherited native props, callback/type traversal, and invalid/missing translations. CT10 supplies a concrete first regression fixture.
- Evidence: Read the extraction, inlining, collection, rendering, and orchestration code. generate() already exposes an in-memory Map and ComponentDoc is already serializable, so there is a natural boundary without redesigning the docs contract. Current tests primarily generate from the live repository rather than supplying adversarial compiler fixtures. A wholesale TypeDoc replacement has **uncertain** payoff: ordinary API extraction would still need adapters for bilingual custom tags, union-mode presentation, copied helper-inlined examples, recipes, Storybook, and the public JSON shape. Prototype that narrow extraction replacement only if the staged split reveals it removes meaningful code.

## Leave as is

- **Release authorization and artifact handoff.** scripts/release.ts:19, .github/workflows/release.yml:38, .github/workflows/release.yml:97, and .github/workflows/release.yml:109 correctly enforce an exact stable tag/version, main ancestry, and publication of the same checked artifact; credentials are available only to the final publish step. Preserve these boundaries while adding consumer validation.
- **The bilingual TSDoc and generated-data contract.** CONTRIBUTING.md:9, scripts/docs.ts:205, scripts/docs.ts:1311, and scripts/docs.ts:1893 maintain one source for editor descriptions, both languages, and machine-readable docs. Keep the standalone copied-snippet check in test/docs.test.ts:235; ordinary example typechecking cannot replace it.
- **Browser testing with real CSS and centralized mounting.** test/browser/render.tsx:21, test/browser/render.tsx:63, test/browser/render.tsx:102, and vitest.config.ts:19 provide explicit React act boundaries, cleanup, pointer parking, real styles, and a deliberate Ant Design development build. Improve the timing primitives without replacing this working harness wholesale.
- **Separate, calibrated performance runs.** vitest.perf.config.ts:14, test/browser/perf/data-table-perf.browser.test.tsx:110, and test/browser/perf/markdown-stream.browser.test.tsx:125 already separate wall-clock budgets from the broad suite and check that long-task reporting works. Keep this architecture; correct the workload/helper mismatch identified above.
- **Token documentation from compiled values.** scripts/tokens.ts:194 and test/docs.test.ts:366 derive reference rows from actual theme compilation and check coverage, avoiding a second handwritten list of token values. No replacement token-doc system is warranted.
