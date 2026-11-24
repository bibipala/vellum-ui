# Subsystem review — codex-subsystems

Read-only audit of `data-table/`, `file-preview/`, `ai/`, `charts/`, and `figures/`, including the relationship to `Image`, `ImageGrid`, and `Lightbox`. Repository guidance in `AGENTS.md` and `CONTRIBUTING.md` was read first; no `dev/plan.md` exists in this checkout. Findings are ranked by practical payoff relative to effort, including how frequently the affected path runs.

Evidence consists of source inspection, relevant test inspection, and two small Node probes against the installed implementation. No repository files were changed, no dependencies were installed, and no build, generated-file command, or test suite was run. WebKitGTK 2.52 was not exercised: browser-specific manifestations and engine-specific size limits remain uncertain. Proposals preserve the visual direction and token-based, interruptible motion system. Public API changes below are explicitly marked; their English and Chinese documentation should be changed in TSDoc when implemented.

### SUB-01 Stop rebuilding all message measurements on scroll-only renders
- Where: src/components/ai/MessageList.tsx:177, src/components/ai/MessageList.tsx:187, src/components/data-table/DataTable.tsx:754
- Kind: perf
- Impact: high — scrolling a long conversation repeatedly does work proportional to the entire history despite rendering only a small window.
- Effort: S (<1h)
- Breaking: no
- Proposal: Memoize `keyAt` over the `items` collection, reading the latest `getKey` through a ref, following DataTable's existing pattern. This removes measurement invalidation on the list's own scroll, jump-state, and announcement renders. Keep invalidation when the item collection changes so prepend/reorder behavior remains correct. This small fix does not remove the separate O(N) work when a streaming update replaces the entire `items` array.
- Evidence: `keyAt` is recreated inside every render and passed directly as `getItemKey`. In the installed `@tanstack/virtual-core` 3.19.9 source, `src/index.ts:1584` includes that function in measurement dependencies; `src/index.ts:1614` resets the rebuild start, and `src/index.ts:1728` loops through every item. A read-only probe with 100,000 items counted **0** key calls after reusing the callback and **100,000** after replacing it with an equivalent callback. Existing chat performance coverage uses only 1,000 messages (`test/browser/perf/chat-perf.browser.test.tsx:138`).

### SUB-02 Reattach SegmentedBar's label observer after loading
- Where: src/components/figures/SegmentedBar.tsx:207, src/components/figures/SegmentedBar.tsx:237, src/components/figures/SegmentedBar.tsx:266, src/components/figures/SegmentedBar.tsx:296
- Kind: bug
- Impact: medium — a tall bar loaded with existing data can permanently omit labels that fit, or retain stale fit decisions after refreshing.
- Effort: S (<1h)
- Breaking: no
- Proposal: Bind measurement to the actual track element with a callback ref, or include the loading/remount transition in effect dependencies and reobserve the replacement track and labels. Reset/recompute fit decisions for the new elements.
- Evidence: The observer effect depends only on the text-derived `labelsKey`. The loading branch renders a different track without `trackRef`. With `loading=true` and nonempty `items`, the effect finds no track; toggling only `loading` to false keeps `labelsKey` unchanged, so it never runs on the real bar. Refreshing an already mounted bar similarly leaves the observer attached to detached elements. The current loading test changes `items` from `[]` to populated data (`test/browser/figures.browser.test.tsx:697`), which changes the key and misses this case.

### SUB-03 Scope preview media state to the source, not just the file ID
- Where: src/components/file-preview/ImageView.tsx:129, src/components/file-preview/ImageView.tsx:438, src/components/file-preview/ImageView.tsx:461, src/components/file-preview/FilePreview.tsx:1122, src/components/file-preview/FilePreview.tsx:1255, src/components/file-preview/content.tsx:169, src/components/file-preview/content.tsx:200
- Kind: bug
- Impact: high — replacing or repairing a file's URL while keeping its stable ID can leave the preview stuck on an error or using another image's geometry.
- Effort: M (half a day)
- Breaking: no
- Proposal: Give the media renderer an explicit source identity and reset loading/error, dimensions, measurement requests, and view state when it changes, while preserving the outer slide's stable ID. A source-keyed inner media component is another simple option. Apply the same source scoping to video/audio errors. Reuse the source-tagged loading-result pattern already present in `Image.tsx:144` and `ImageGrid.tsx:140` where appropriate, while keeping the viewer's WebKit SVG measurement workaround.
- Evidence: Slides and inline contents are keyed by `item.id`, so a changed `src` need not remount ImageView. Its natural size/status are initialized only once. After an error, the `<img>` is removed, so a new source cannot trigger recovery. If the new source is already in `naturalSizes`, `settle` returns immediately without updating the mounted component's dimensions/status. VideoContent and AudioContent also keep an unqualified `error` boolean and return the failure card before rendering the replacement URL. A still-pending measurement is not invalidated merely by a source-prop change either.

### SUB-04 Make gesture cancellation and pinch takeover explicit transitions
- Where: src/components/file-preview/FilePreview.tsx:411, src/components/file-preview/FilePreview.tsx:475, src/components/file-preview/FilePreview.tsx:494, src/components/file-preview/FilePreview.tsx:914, src/components/file-preview/FilePreview.tsx:921
- Kind: bug
- Impact: high — cancelling a drag can switch files, and starting a pinch during a swipe or dismiss can leave the track displaced or the backdrop faded.
- Effort: M (half a day)
- Breaking: no
- Proposal: Extract the gesture tagged union into a small controller/reducer with separate `finish`, `cancel`, and `takeOverWithPinch` events. Cancellation must settle the track/dismiss progress without navigating. Pinch takeover must undo the previous gesture's track/backdrop effects before starting image zoom. Keep transform writes imperative for pointer-frequency updates and retain CSS transitions and motion tokens for settling. This is a useful split out of the 1,358-line FilePreview file; leave dialog presence and toolbar rendering in the shell.
- Evidence: `onPointerCancel` calls the same `finish` path as pointer-up. For swipes it only zeroes velocity, preserving displacement; the swipe-end callback still calls `go` when displacement exceeds its threshold. A second pointer directly replaces `gesture.current` with `pinch` after freezing the image, without settling `o.swipe` or `o.dismiss`. The former owns the track transform, and the latter owns `--fp-dismiss` and `data-dragging`, which image pinch-end does not reset. The existing gesture union is a good foundation; a heavyweight state-machine dependency is unnecessary.

### SUB-05 Replace argument-spread extrema with bounded-memory scans
- Where: src/components/charts/heatmap-model.ts:91, src/components/charts/scatter.ts:120, src/components/charts/bar.ts:302, src/components/charts/cartesian.ts:58
- Kind: bug
- Impact: medium — sufficiently large chart datasets throw a RangeError before the engine can render them.
- Effort: S (<1h)
- Breaking: no
- Proposal: Use a loop/reduction for heatmap and scatter extrema and for the longest bar label. Reuse or adapt the existing iterative `extent` helper rather than allocating coordinate arrays and spreading them into function arguments.
- Evidence: Heatmap uses `Math.min(...values)` and `Math.max(...values)`; scatter does the same for all visible x/y values; value-labelled bars spread all label lengths. Running the heatmap domain function's exact extracted body in Node succeeded at 100,000 cells and threw `RangeError: Maximum call stack size exceeded` at 250,000. The failure mechanism is definite; the precise threshold in WebKitGTK 2.52 is uncertain and should not be relied on as a limit. `cartesian.extent` already demonstrates the safe implementation.

### SUB-06 Preserve focused content in message and image virtualization
- Where: src/components/ai/MessageList.tsx:182, src/components/ai/MessageList.tsx:410, src/components/ImageGrid.tsx:247, src/components/ImageGrid.tsx:269, src/components/data-table/DataTable.tsx:761
- Kind: a11y
- Impact: high — scrolling a focused message action, citation, or image tile out of the rendered window can remove the active element and lose keyboard position.
- Effort: M (half a day)
- Breaking: no
- Proposal: Track the focused message/tile by stable identity and include its row in the virtual range until focus leaves the widget. Extract a small shared focused-range helper from DataTable if that reduces duplication. For ImageGrid, resolve the retained tile to its current row after column-count changes. Verify focus survival during wheel scrolling and window resizing.
- Evidence: MessageList and ImageGrid render only `getVirtualItems()` and supply neither a focused-item range extractor nor focus/blur retention logic. Their rows contain real buttons and links. DataTable explicitly handles this same problem with `focusedKey`, a range extractor, and focus/blur handlers; its comment describes focus otherwise falling to the body. Current chat-list focus tests concern the scroller and jump button, not an interactive child retained outside the viewport.

### SUB-07 Produce completion announcements from data rather than mounted rows
- Where: src/components/ai/MessageList.tsx:96, src/components/ai/MessageList.tsx:370, src/components/ai/MessageList.tsx:376, src/components/ai/MessageList.tsx:456
- Kind: a11y
- Impact: medium — the promised completed-reply announcement disappears when the user is reading older messages and the final row is virtualized away.
- Effort: M (half a day)
- Breaking: yes
- Proposal: Add a library-owned announcement contract such as `getAnnouncement(item): string` and derive completion text from the final item independently of visible DOM. Prefer making that contract required when completion announcements are enabled, replacing undocumented descendant selectors. Represent announcements as events so two consecutive replies with identical text can still be announced. Document the new contract in English and Chinese TSDoc.
- Evidence: On the single `streaming: true → false` transition, the effect queries the last row by `data-index` and immediately returns if it is absent. When paused far enough from the bottom, absence is the expected virtualized state; the transition is consumed and never retried. It also stores only text, so an identical subsequent result produces no state/DOM update. The existing completion test uses six messages and keeps the last row mounted (`test/browser/chat-list.browser.test.tsx:282`).

### SUB-08 Defer chart-table preparation and bound the table's DOM
- Where: src/components/charts/LineChart.tsx:148, src/components/charts/BarChart.tsx:160, src/components/charts/ScatterChart.tsx:171, src/components/charts/Heatmap.tsx:167, src/components/charts/cartesian.ts:198, src/components/charts/ChartContainer.tsx:176, src/components/charts/ChartContainer.tsx:275
- Kind: perf
- Impact: medium — every dataset update formats a complete alternate table even in chart view, and opening the table mounts every cell despite its small scroll viewport.
- Effort: L (days)
- Breaking: yes
- Proposal: Replace the eager `ChartContainer.table` data prop with a lazy provider such as `getTable`, invoked and memoized by the table-view component only when selected. Apply the native-table row-windowing pattern already used by DataTable for larger tables, preserving headers and ARIA row counts. Keep table models independent of legend visibility where the documented table includes hidden series. This also gives line/bar/scatter wrappers one shared seam for table preparation without merging their distinct geometry models.
- Evidence: All the named wrappers calculate `table` with `useMemo` before ChartContainer chooses its current view. `cartesianTable` formats each value and allocates every row; `scatterTable` does likewise (`src/components/charts/scatter.ts:173`). Scatter's table depends on the entire model, including hidden keys, even though it includes all series. ChartTable maps every row/cell. A CSS max-height (`ChartContainer.tsx:409`) limits visible height, not rendered work. Number formatters themselves are already cached (`src/components/charts/format.ts:45`); recreating Intl formatters is not the issue.

### SUB-09 Avoid serializing collapsed tool results on every chat update
- Where: src/components/ai/ToolCalls.tsx:94, src/components/ai/ToolCalls.tsx:126, src/components/ai/ToolCalls.tsx:179, src/components/ai/ToolCalls.tsx:185
- Kind: perf
- Impact: medium — a large completed tool result can be JSON-stringified repeatedly while unrelated steps or streamed message content change, even if its details were never opened.
- Effort: M (half a day)
- Breaking: no
- Proposal: Move input/output rendering into a memoized ToolDetails component, keyed by input/output identity, and defer its first serialization until the user expands that call. Preserve mounted details after first opening if retaining selection/scroll position is desired. Isolate each tool row so changing one running step does not prepare every completed step again.
- Evidence: ToolCalls maps the entire array on each render and evaluates `detailText(item.input/output)` while constructing elements, before ThoughtChain can decide whether to mount collapsed content. `detailText` runs a full pretty-printed `JSON.stringify`; neither `expanded` nor stable result identity guards that work. `maxHeight` bounds the code block viewport, not serialization or text size. This is a source-confirmed redundant-work path; its wall-clock impact depends on result sizes and was not benchmarked.

### SUB-10 Bound the global image-dimension cache
- Where: src/components/file-preview/ImageView.tsx:99, src/components/file-preview/ImageView.tsx:445, src/components/file-preview/content.tsx:35
- Kind: perf
- Impact: medium — a long-running desktop session retains every distinct image URL and dimension entry, including object URLs that have already been revoked.
- Effort: S (<1h)
- Breaking: no
- Proposal: Give `naturalSizes` a small LRU bound and avoid globally caching transient blob URLs, or tie those entries to the lifetime of the source resource. Retain the cache for recent reusable image URLs and the separate WebKit SVG size probe.
- Evidence: The module-level Map only has reads and `set`; there is no delete, clear, or eviction. `useItemUrl` correctly revokes URLs on cleanup, but each reopening of a Blob can generate a fresh URL that becomes another permanent Map key. This retains URL strings and size records, not the Blob's decoded pixels after revocation; the finding concerns unbounded metadata growth, not a claimed decoded-image leak.

### SUB-11 Split DataTable by state ownership and remove incidental full-data scans
- Where: src/components/data-table/DataTable.tsx:497, src/components/data-table/DataTable.tsx:503, src/components/data-table/DataTable.tsx:555, src/components/data-table/DataTable.tsx:570, src/components/data-table/DataTable.tsx:632, src/components/data-table/DataTable.tsx:749, src/components/data-table/model.ts:300
- Kind: refactor
- Impact: medium — selection, persistence, resize, focus retention, and viewport measurement currently share one render/effect lifetime, making changes hard to reason about and putting avoidable O(N) work on local UI updates.
- Effort: L (days)
- Breaking: no
- Proposal: Extract three internal hooks: `useColumnPreferences` for storage and committed/transient column widths; `useTableSelection` for controlled/uncontrolled selection, range anchors, and selected aggregates; and `useTableViewport` for observers, edges, header height, and focused-row virtualization. Extract the header view separately from the existing memoized row. Memoize `selectedShown` over `selectableKeys`/`selectedSet`, and build a key-to-index map per displayed dataset for focus/range lookups. Keep the current pure column-layout model and native table DOM.
- Evidence: These responsibilities already form explicit blocks but occupy one roughly 600-line component body. `selectedShown` reduces all selectable keys on every render, including virtual-range scroll updates. A retained focused row causes `display.findIndex` on every render (`DataTable.tsx:763`); shift-selection performs another scan at `DataTable.tsx:589`. Storage refs and transient resize commits are distinct from row selection and can be tested independently after extraction. This is lower priority than the concrete bugs above; file length alone does not justify a rewrite.

## Leave as is

1. **The shared viewer boundary.** `Lightbox.tsx:98` adapts image items into `PreviewDialog`; `Image.tsx:223` uses the same dialog. Lightbox and FilePreview do not contain two competing gesture/viewer engines. ImageGrid's virtualized thumbnail layout is a separate responsibility. Preserve that consolidation rather than creating another viewer abstraction.
2. **ECharts instance ownership and lazy module loading.** `charts/engine.tsx:49`, `charts/engine.tsx:174`, `charts/engine.tsx:219`, and `charts/engine.tsx:243` already centralize lazy loading, observer disconnection, instance disposal, resize, and option application. Size changes normally reuse the instance; theme/reduced-motion changes reread the palette. There is no source evidence here for replacing the lifecycle or adding a second chart wrapper framework.
3. **DataTable's native-table virtualization.** `data-table/DataTable.tsx:761`, `data-table/DataTable.tsx:857`, and `data-table/DataTable.tsx:948` preserve focused rows, render real table rows with gap spacers, and expose total row position/count. The memoized Row and pure `model.ts` helpers are useful existing boundaries. Keep these through the proposed extraction.
4. **Stream runner and reader cleanup.** `ai/useStream.ts:110`, `ai/useStream.ts:138`, `ai/useStream.ts:169`, and `ai/useStream.ts:243` cancel scheduled flushes, abort superseded requests, and reject stale run updates; `ai/stream.ts:118` and `ai/stream.ts:132` cancel readers and remove abort listeners. No additional scheduler/state-machine framework is justified by these paths.
5. **Markdown's existing optimized path.** `ai/Markdown.tsx:111`, `ai/Markdown.tsx:115`, and `ai/markdown-renderer.tsx:38` keep settings/component/config identities stable, lazy-load the heavy renderer, and enable incremental rendering. The installed XMarkdown implementation memoizes completed heading sections. Its limitation is explicit: headerless content or reference definitions can force whole-document parsing; the current performance fixture contains frequent headings (`test/browser/perf/markdown-stream.browser.test.tsx:14`). Performance for long unheaded replies on WebKitGTK 2.52 is **uncertain**, so expand that fixture before considering a renderer rewrite. A Node parser-only check averaged roughly 1.2/4.7/6.7 ms at 10k/50k/100k characters; this excludes DOM sanitization, React rendering, and WebKit, and does not establish a browser performance failure.
