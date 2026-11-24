# vellum-ui styling and motion review (claude-styling)

Scope covered: `src/tokens/*`, `src/theme/*`, `src/themes/index.ts`, `src/base.css`, `src/global.css`, `src/styles.css`, all 47
`*.module.css` files, and the antd 6.7.0 / @ant-design/cssinjs 2.1.2 sources that the overrides depend on. Token usage was
checked by compiling the default theme with Node (scratch scripts in `/tmp/vellum-review/claude-styling/`) and searching
`src/` for every compiled name, including template-string references such as `` `color-chart-${n}` ``.

Overall: token discipline in the CSS modules is very good. In all CSS there is one literal color (`base.css:836`) and no
literal durations or easings outside the reduced-motion and fallback blocks. Most of the debt is in three places: (1) the
antd bridge (two sources of truth for derived colors, a specificity arms race, and dependencies on antd internals);
(2) a few components that still use one-shot keyframes or have no exit motion; (3) repeated interaction primitives (focus
ring, spinners, scrollbars) that should be single rules or tokens.

Findings are ranked by value (impact divided by effort).

---

### S1 Message enter/exit uses one-shot keyframes, so it cannot be interrupted, and the exit time is defined twice
- Where: src/components/message.module.css:45-53, src/components/message.module.css:85-97, src/components/message.module.css:117-133, src/components/messageStore.ts:69, src/components/messageStore.ts:115-129, src/components/messageStore.ts:136-147, src/components/message.tsx:338
- Kind: motion
- Impact: high. A message re-opened with the same `key` while it is leaving (`messageStore.ts:136` "正在离开的也召回") drops `data-leaving`. The animation then switches from `message-out` back to `message-in`, so the message jumps to `translateY(100%)` and opacity 0 and slides up again. Closing a message while it is still entering jumps to fully shown before fading, because `message-out` has only a `to` keyframe. Both violate the "can turn back halfway" rule in AGENTS.md and motion.md, for the one component the motion guide lists as "slides up along the spring".
- Effort: S
- Breaking: no
- Proposal: Use the Drawer pattern. `.message { transition: opacity <base> standard, transform <spring> spring }`, with the start state given in `@starting-style { .message { opacity: 0; transform: translateY(100%) } }`, and `.message[data-leaving] { opacity: 0; transform: translateY(var(--vl-space-2)); transition-duration: <exit>; transition-timing-function: var(--vl-motion-ease-exit); pointer-events: none }`. Remove the 140 ms literal (`messageStore.ts:69`). Either remove on `transitionend`, with a fallback timer, or read the exit token through the existing `cssMs` helper (`message.tsx:258-262`). Under reduced motion it then resolves to 0 and the message is removed at once, instead of a stale 140 ms timer. Delete the reduced-motion swap at `message.module.css:117-133`. It is already dead: under reduced motion every `--vl-motion-duration-*` is 0 (`base.css:898-916`), so the fade fallback also lasts 0 ms. FLIP (`message.tsx:285-292`, `composite: 'add'`) still works on top of a transition.
- Evidence: read message.module.css in full, messageStore.ts `leave()` and `open()`, and message.tsx `MessageItem` and `useFlip`. The CSS exit duration `calc(base * 0.7)` (= 140 ms) and the JS `leaveMs: 140` are two copies of one value; changing `motionDurationBase` in a theme puts them out of sync.

### S2 Reduced motion does not reach antd's own motion: Loading keeps spinning and PageSkeleton keeps shimmering
- Where: src/base.css:897-916, src/theme/antd.ts:151-156, src/components/feedback.tsx:202, src/components/feedback.tsx:253-260, src/components/display.tsx:798, src/components/ai/reasoning.module.css:10-16, src/components/ai/tool-calls.module.css:13-19
- Kind: motion
- Impact: high. motion.md ("Reduced motion") promises that "loading indicators do not spin". However, `Loading` renders antd `<Spin />`, whose keyframes have hard-coded durations (`antd/es/spin/style/index.js:147-148` 1.2s, `:163-164` 1s). `PageSkeleton` uses antd `Skeleton active`, whose shimmer is `skeletonLoadingMotionDuration: '1.4s'` (`antd/es/skeleton/style/index.js:23,353`). Nothing in base.css stops either one. The other antd transitions use fixed seconds from `antd.ts:151-153`, which reduced motion never zeroes. Only Reasoning and ToolCalls patch this, each with a local bridge.
- Effort: S
- Breaking: no
- Proposal: (1) In `toAntdTheme`, pass `motionDurationFast/Mid/Slow: cssVar('motion-duration-fast' | 'motion-duration-base' | 'motion-duration-slow')` instead of `sec(...)`, and do the same for the Tabs and Segmented overrides (`antd.ts:268,281`). antd uses these tokens only inside generated style strings: the only non-style use is `_util/wave/style.js`, and wave is disabled. The one piece of math, `calc(${motionDurationSlow} + 0.1s)` in `menu/style/index.js:29`, stays valid with `var()`. Each antd root's `--vl-ant-motion-duration-*` then inherits the vl tokens and zeroes with reduced motion, so delete the two local bridges. Zeroing `--vl-ant-*` on `:root` does not work, because antd declares those variables on each component root (as reasoning.module.css:10-13 notes). (2) Render Loading with the shared vl spinner (see S6) instead of antd Spin. Pass `active={active && !reducedMotion}` to antd Skeleton, or add `.ant-skeleton-active … { animation: none }` inside the reduced-motion blocks. (3) Optional: have `compileTheme` emit zero durations when ThemeProvider's `reducedMotion` is true, so base.css keeps only the `@media` block. Today base.css:909-916 duplicates base.css:898-907 line for line.
- Evidence: grep for `ant-spin` or `ant-skeleton` in src CSS finds nothing. I read the antd Spin and Skeleton style sources, antd `theme/util/alias.js:35-40` (`motion: false` zeroes only the three duration tokens, not Spin's literals), and searched antd/es for JS that parses `motionDuration*` (none). Uncertain: antd transitions that rc-motion waits on could stall until `motionDeadline` once durations are 0. The popups and the collapse that rc-motion drives are already wrapped in `max(…, 1ms)` in base.css, so verify with the existing reduced-motion tests.

### S3 The Switch fix and other overrides depend on antd-internal CSS variables and inline-style strings
- Where: src/base.css:127-153, src/base.css:320-326, src/base.css:781-805, src/theme/antd.ts:299-305
- Kind: refactor
- Impact: high. If antd renames or stops emitting `--vl-ant-switch-track-min-width`, `--vl-ant-switch-handle-size`, `--vl-ant-switch-track-padding` or their `-sm` variants (they are cssVar names derived from component tokens), then `--vl-switch-travel` becomes guaranteed-invalid. `transform` and `inset-inline-start` on the checked handle then resolve to `none` and `auto`, while the `:root:root` rule still wins the cascade over antd's own position. A checked switch would show its knob on the "off" side, and nothing would report an error. The same silent-failure class applies to the slider end marks, which are matched by inline-style substring (`[style*="left: 0%"]`, depending on how the browser serializes inline styles), and to the Select padding, which uses the undocumented `genCssVar` names `--ant-select-padding-horizontal` and `--ant-select-multi-padding-vertical`.
- Effort: S
- Breaking: no
- Proposal: Own the switch geometry. Put `trackMinWidth 36 / handleSize 16 / trackHeight 20` (plus the sm sizes) in one TS constant that feeds both antd.ts:299-302 and new component tokens (`switch-track-width`, `switch-handle-size`, `switch-track-padding`), and compute `--vl-switch-travel` from vl tokens only. For slider marks, the Slider wrapper can pass per-mark `style` through antd's public `marks` API (`{ style, label }`) instead of matching the inline style string. For the remaining internal dependencies (Select padding vars, rc-motion class names in base.css:458-613, `.ant-popover-container` in base.css:77), add one browser test per dependency that fails if the variable or class disappears. For example, assert that the computed `--vl-switch-travel` is a length and that the handle of a checked switch is translated.
- Evidence: listed every `var(--vl-*)` referenced but never defined. Only the five `--vl-ant-switch-*` names appeared, all in base.css. Verified that antd 6.7 switch/style/index.js uses `trackPadding`, `trackMinWidthSM` and `handleSizeSM`, and that `genCssVar` (`antd/es/theme/util/genStyleUtils.js:48-56`) builds the `--ant-select-*` names from `antCls`. The Select names are correct today, but they are internal.

### S4 Move antd's runtime CSS into a cascade layer to retire the specificity arms race
- Where: src/base.css (33 `:root:root:root`, 44 `:root:root` and 24 `:root`-prefixed selectors; `!important` at src/base.css:81, src/base.css:263, src/base.css:268, src/base.css:623, src/base.css:625), src/components/ai/reasoning.module.css and src/components/ai/tool-calls.module.css (20 `.root.root` selectors), src/components/inputs.module.css:14-25, src/components/upload.module.css:10-12, src/components/overlays.module.css:8, src/components/overlays.module.css:71, src/components/overlays.module.css:109, src/theme/ThemeProvider.tsx:305-318
- Kind: refactor
- Impact: high. About 120 selectors exist only to beat antd's injection order or specificity. Many comments say exactly that, for example "与样式注入顺序无关" and inputs.module.css:17 ("antd 的样式在运行时注入，排在本库样式之后"). Every new override has to work out antd's maximum specificity, such as base.css:281 "(0,5,0)", which is fragile on every antd minor update.
- Effort: M
- Breaking: no public API change. CSS precedence for consumers changes: their unlayered CSS would always beat antd, which is usually what they want. Note it in MIGRATION.md.
- Proposal: Wrap the tree in `<StyleProvider layer>` from `@ant-design/cssinjs`. Version 2.1.2 has `layer?: boolean` (StyleContext.d.ts:36), and useStyleRegister.js:183-189 emits `@layer antd {…}`. Add it as a direct dependency: it is only transitive today, and pnpm is strict. Place it inside ThemeProvider around ConfigProvider. @ant-design/x uses the same context. Then unlayered base.css and module rules win regardless of specificity or order, and the `:root` ladders, doubled classes and four of the five `!important`s can be dropped. Caveat: antd's collapse motion is `!important` (`antd/es/style/motion/collapse.js:12`), and a layered `!important` beats an unlayered one. Replace base.css:620-626 with per-component token overrides in antd.ts for Tree, Menu, Collapse, Form and Upload (`motionDurationMid: 'max(var(--vl-motion-duration-spring), 1ms)'`, `motionEaseInOut: 'var(--vl-motion-ease-spring)'`), since `genCollapseMotion` reads those two tokens of the component (uncertain: verify that the component-level alias override reaches it in cssVar mode). Document the layer name for consumers who use their own layers, such as Tailwind v4. WebKitGTK supports `@layer` (Safari 15.4+). The `!important` popup shadow at base.css:81 may be redundant already, because antd.ts:157-158 maps `boxShadow` and `boxShadowSecondary` to `--vl-shadow-float` (uncertain: dropdown/style:136,156 sets `boxShadow: 'none'` on sub-parts).
- Evidence: counted the selectors with grep. Read the cssinjs StyleContext and useStyleRegister sources, and checked that vellum does not use StyleProvider (grep finds nothing).

### S5 Derived colors are computed twice (compile.ts and antd.ts) and already disagree; masks and status halos have no token
- Where: src/theme/compile.ts:142-175, src/theme/compile.ts:250-306, src/theme/antd.ts:47-57, src/theme/antd.ts:65, src/theme/antd.ts:86-88, src/theme/antd.ts:99-101, src/theme/antd.ts:147-149, src/theme/antd.ts:285-288, src/base.css:755-773, src/base.css:781-791, src/components/app-shell.module.css:211, src/tokens/component.ts:30-32, src/theme/compile.ts:516-529, src/components/file-preview/file-preview.module.css:117-123
- Kind: consistency
- Impact: medium-high. The same visual values are hand-copied, and some copies already diverge:
  - The primary-button hover in antd is `accentFill +0.04` in both modes (antd.ts:56). The public `--vl-color-accent-fill-hover` (deriveStates) is `+0.06` in light and `-0.06` in dark, the opposite direction.
  - antd link active lightens in light mode (antd.ts:88, `+0.04`), but `--vl-color-accent-text-active` darkens (compile.ts:303-306, `-0.112`).
  - The error and warning focus halo is 0.18 light / 0.30 dark for outlined fields (antd.ts:65), but `color-mix` 20% / 22% in both modes for the default filled variant (base.css:762,772). In dark mode the error halo is weaker than the accent halo (0.26).
  - The AppShell narrow-layout scrim uses `--vl-color-shadow` (10% alpha in light mode), while antd Drawer and Modal masks use `colorBgMask` (32%, antd.ts:99-101). That mask color exists only inside antd.ts.
  - State-layer alphas (compile.ts:293-294 and antd.ts:48-49), fill-selected (compile.ts:301 and antd.ts:50), focus halo (compile.ts:291 and antd.ts:51), control heights (component.ts:30-32 and antd.ts:147-149) and field padding 14/12/16 (antd.ts:77 and base.css:782-790) are each written in two places.
  - Because antd receives hex snapshots, scoped theming (`toCssText(vars, '[data-brand]')`, documented at compile.ts:516-521) and local remaps such as the FilePreview toolbar do not reach antd-rendered components.
- Effort: M
- Breaking: no if the shared values are kept as they are. Yes if the drifted values are unified to the CSS side (a visual change: show screenshots first).
- Proposal: Add one `deriveColors(colors, mode)` that returns Oklch values (fillHover/Active/Selected, focusHalo, dangerHalo, warningHalo, mask, tooltipBg, controlFill.*, fieldFill.*, accentFillHover/Active, linkHover/Active). `colorTokens` formats it and `toAntdTheme` converts it to hex. New tokens: `--vl-color-mask`, used by antd `colorBgMask` and the AppShell scrim, plus `--vl-color-danger-halo` and `--vl-color-warning-halo`, or `--vl-shadow-focus-*` (see S9). Export the control heights and field paddings as one numeric constant for componentTokens and antd.ts, and as a CSS var that base.css can read. Wherever antd uses a token only as a CSS value (component tokens such as `defaultBg`, `activeBg`, `itemSelectedBg`, `optionSelectedBg`), pass `cssVar(...)` the way antd.ts:157-160 already does for shadows, and keep hex only for seed tokens that the antd algorithm derives from (uncertain: some antd components may run color math on particular component tokens; verify per token).
- Evidence: read compile.ts and antd.ts side by side, plus themes/index.ts:165 (light `shadow` alpha 0.1) and app-shell.module.css:206-213.

### S6 Eight copies of a spin keyframe and four copies of a pending fade; Loading uses a different spinner
- Where: src/components/message.module.css:111, src/components/inputs.module.css:41, src/components/inline-edit.module.css:81, src/components/upload.module.css:130, src/components/ai/chat-message.module.css:95, src/components/ai/tool-calls.module.css:58, src/components/ai/reasoning.module.css:101, src/components/ai/message-list.module.css:127 (spin); src/components/feedback.module.css:99, src/components/ai/chat-message.module.css:89, src/components/figures/statistic.module.css:116, src/components/figures/segmented-bar.module.css:198 (pending-in); src/components/feedback.tsx:202 (antd Spin)
- Kind: simplify
- Impact: medium. About 90 duplicated lines (a mix of `rotate(1turn)` and `rotate(360deg)`). The "delay then fade in" loading rule (`motion-delay-loading`) is re-implemented four times. Loading's antd Spin does not follow reduced motion (S2).
- Effort: S
- Breaking: no
- Proposal: In base.css, define `@keyframes vl-spin` and `vl-pending-in` with attribute utilities in the style of `data-vl-state`: `[data-vl-spin] { animation: vl-spin var(--vl-motion-duration-loop) linear infinite }`, and `[data-vl-pending] { animation: vl-pending-in var(--vl-motion-duration-fast) var(--vl-motion-ease-standard) var(--vl-motion-delay-loading) both }` with `[data-vl-pending="immediate"]` setting no delay. Use them in all 12 places and render Loading with the vl spinner. Looping spinners are legitimately keyframes; this is purely de-duplication.
- Evidence: grep `@keyframes` across src. Every spin keyframe has the same body, and every pending-in is `from { opacity: 0 }`.

### S7 AppShell narrow-layout scrim: keyframe entry, instant exit, and a sidebar exit as slow as its entry
- Where: src/components/app-shell.module.css:120-122, src/components/app-shell.module.css:165-179, src/components/app-shell.module.css:199-213, src/components/app-shell.module.css:216-220
- Kind: motion
- Impact: medium. When the sidebar drawer closes, the scrim disappears instantly (`display: none` as soon as `data-open` goes away) while the panel slides out for 280 ms. Rapid toggling restarts the scrim fade from 0, because it uses a one-shot keyframe. The panel's exit uses `--vl-motion-duration-slow`, the same as its entry, which breaks "leaving is faster than entering". The scrim color is `--vl-color-shadow`, not the mask color the Drawer uses (S5). These are the same problems the library's own Drawer already solves.
- Effort: S
- Breaking: no
- Proposal: Copy overlays.module.css:73-103. In the narrow container query, always render the scrim with `opacity: 0; visibility: hidden; pointer-events: none` and a transition on opacity plus a delayed visibility. `[data-open]` sets `opacity: 1; visibility: visible` (enter uses base and standard; exit uses the exit token and ease-exit). The sidebar close uses the exit duration (S10) instead of slow. Use `--vl-color-mask`.
- Evidence: read app-shell.module.css in full.

### S8 Unused compiled tokens, mostly the derived `-hover`, `-active` and `-disabled` states that contradict the state-layer rule
- Where: src/theme/compile.ts:250-277, src/theme/compile.ts:281, src/tokens/component.ts:33, src/tokens/component.ts:37, src/tokens/component.ts:74, docs/en-US/guides/custom-styles.md:31, stories/ThemeOverview.stories.tsx:27
- Kind: dead-code
- Impact: medium. 23 public CSS variables are unused by every component. 19 derived states: `color-{accent}-{hover,active,disabled}`, `color-accent-fill-{hover,active,disabled,subtle}` and `color-{danger,warning,success,info}-{hover,active,disabled}`. Also `color-border-strong-hover` (antd gets the hex directly), `button-height-md`, `table-header-bg` and `lightbox-control-size`. custom-styles.md:31 advertises the `-hover` and `-active` variants, while the same guide's rule 5 tells consumers to use the shared state layer instead. One of them (`accent-fill-hover`) already disagrees with the antd primary button (S5).
- Effort: S
- Breaking: yes (removes documented CSS variables)
- Proposal: Have `colorTokens` emit only `-subtle` and `-text` for the status colors (`accent-subtle` is used: upload.module.css). Keep the `deriveStates` export for consumers who need the math, or reduce it to `subtle` and `disabled`. Remove the four component tokens and `color-border-strong-hover`. Update custom-styles.md, the token reference, and the ThemeOverview story.
- Evidence: compiled the default theme (292 variables) and searched src for each name, both as `--vl-<name>` and as template patterns such as `` color-chart-${…} `` or `` var(--vl-radius-${…}) ``. False positives were excluded by hand: `color-chart-N-on` is referenced through `segments.ts:79`, `grid-column-md` through `layout.tsx:260`, `radius-2xl` through `layout.tsx:436`. The 27 primitive palette variables are also unused internally, which is by design (documented as public).

### S9 Focus ring, focus halo, state layer and scrollbar are re-declared per module instead of shared
- Where: `outline: 2px solid var(--vl-color-focus-ring)` 22 times in 16 files (e.g. src/components/app-shell.module.css:44-45, src/components/ai/sources.module.css:38-39, src/components/ai/sources.module.css:167-168, src/components/upload.module.css:41-42, src/components/charts/plot.module.css:21-22, src/global.css:86-87, src/base.css:9-10, src/base.css:273-274, src/base.css:303-304); halo `0 0 0 3px var(--vl-color-focus-halo)` at src/base.css:364, src/base.css:871, src/components/ai/prompt-input.module.css:27, src/theme/antd.ts:73; hand-rolled hover/press layers at src/components/ai/sources.module.css:26-39, src/components/ai/tool-calls.module.css:116-130, src/components/ai/reasoning.module.css:31-45; scrollbars at src/global.css:53-82 and src/components/data-table/data-table.module.css:105-130
- Kind: token
- Impact: medium. A change to ring width, offset or halo size today means editing about 25 places in CSS plus `lineWidthFocus` and `controlOutlineWidth` in antd.ts. The Sources and ToolCalls toggles are plain owned `<button>`s (Sources.tsx:114-118, ToolCalls.tsx:150-154) that rebuild by hand what `data-vl-state` already provides. Most of the "pixel literals other than 0/1px" in internal CSS come from these repeats.
- Effort: S
- Breaking: no (additive tokens)
- Proposal: Add `focus-ring-width: 2px`, `focus-ring-offset: 2px` and `shadow-focus: 0 0 0 3px var(--vl-color-focus-halo)` (plus danger and warning variants from S5), and feed `lineWidthFocus` and `controlOutlineWidth` from the same constant. Add a `[data-vl-focus]` utility in base.css for elements that need the ring without the state layer. Switch the Sources and ToolCalls toggles to `data-vl-state`. The Reasoning header is rendered by antd X, so it keeps its own rule. Move the custom scrollbar to a base.css utility (`[data-vl-scroll]`) with a `--vl-scrollbar-size` token, used by DataTable and global.css.
- Evidence: counted the repeats with grep (`outline-offset: 2px` 18 times; `-2px` 5 times). Read the three AI modules and the two scrollbar blocks, which are identical apart from `999px` versus `radius-full`.

### S10 Exit durations are ad hoc; add exit tokens
- Where: src/base.css:563-566 (popups: fast), src/base.css:689 (tab content: fast), src/components/overlays.module.css:93, src/components/overlays.module.css:100 (Drawer: base), src/components/message.module.css:51 + src/components/messageStore.ts:69 (`calc(base * 0.7)` and the literal 140), src/components/app-shell.module.css:177 (sidebar: slow), src/components/file-preview/file-preview.module.css:71-74 (fast)
- Kind: token
- Impact: medium. Exits that should share one rule ("exit uses the exit easing and a shorter duration") use four different values. One of them is derived by an unexplained 0.7 factor and duplicated in JS. AppShell's exit is not shorter than its entry.
- Effort: S
- Breaking: no (additive)
- Proposal: Add `motionDurationExit` (small things, default 120 ms, equal to fast) and `motionDurationExitPanel` (drawers and sheets, default 200 ms) to `SemanticScale`. Compile them to `--vl-motion-duration-exit` and `-exit-panel`, zero them in the reduced-motion blocks, and use them in all six places. Scripts read them through `cssMs`. Update the motion guide's token table.
- Evidence: read every leave or exit rule in base.css, overlays, message, app-shell and file-preview.

### S11 `vl-rise` and the other one-shot entrance keyframes contradict the motion rule; one has no exit at all
- Where: src/base.css:889-895, src/components/patterns.module.css:10, src/components/ai/message-list.module.css:103, src/components/ai/MessageList.tsx:436, src/global.css:113-118, docs/en-US/guides/custom-styles.md:59-71, translateY(4px) literals at src/base.css:893, src/global.css:116, src/components/ImageGrid.module.css:139
- Kind: motion
- Impact: low-medium. AGENTS.md says "不用一次性的 keyframes" and motion.md shows the `@starting-style` recipe, yet custom-styles.md teaches consumers `animation: global(vl-rise)`. The MessageList "jump to latest" pill enters with `vl-rise` and disappears instantly on unmount (`jump.visible &&`). `vl-fade-in` in global.css repeats `vl-rise`, and all three use `4px` instead of `var(--vl-space-1)`.
- Effort: S
- Breaking: yes if `vl-rise` is removed (it is documented)
- Proposal: Give Page and the pills `@starting-style { opacity: 0; transform: translateY(var(--vl-space-1)) }` with a transition on spring tokens. Give the jump pill a `data-leaving` state, or keep it mounted and toggle `visibility` with a delayed transition. Keep keyframes only where they are required (View Transition pseudo-elements), as one shared keyframe that uses `var(--vl-space-1)`. Rewrite the custom-styles "Entrance motion" section around `@starting-style`. WebKitGTK 2.52 already relies on `@starting-style` in Drawer and FilePreview.
- Evidence: grep `animation:` across src. Read MessageList.tsx:428-449 for how the pills mount.

### S12 Small literal leaks around the token scale
- Where: 4px radius at src/theme/antd.ts:145, src/theme/antd.ts:212, src/base.css:951, src/components/ai/markdown.module.css:112, src/tokens/component.ts:97; `999px` at src/global.css:68, src/components/extras.module.css:138, src/components/extras.module.css:176, src/components/extras.module.css:189; `font-weight: 560` at src/components/extras.module.css:142, src/components/ImageGrid.module.css:134; literal pressed shadow at src/base.css:836; antd-only literals at src/theme/antd.ts:219-220 (header 52 / `0 20px`), src/theme/antd.ts:236-239 (11 / 16 / 18), src/theme/antd.ts:273 (999), src/theme/antd.ts:288 (`#ffffff`)
- Kind: token
- Impact: low. Each literal is harmless alone. Together they mean a theme changing `radius` or `fontWeight` (both documented as themable in SemanticScale) does not reach these spots, and the "only 0 and 1px" rule the library asks of consumers has visible exceptions inside the library.
- Effort: S
- Breaking: no (additive `radius-xs`, `shadow-raised-pressed`), unless 560 is mapped to 500 or 600 (a visual change)
- Proposal: Add `radius-xs: 4` to `radiusScale` and use it for checkboxes, tree checkboxes, task checkboxes and segmented-bar blocks. Use `--vl-radius-full` instead of `999px`. Either add `fontWeight.strong = 560` or settle on 500 or 600. Move base.css:836 into compile.ts next to `shadow-raised` (compile.ts:461-462) as `shadow-raised-pressed`. Read Menu `groupTitleFontSize`, Tag radius and Badge `dotSize` in antd.ts from the scale or tokens (`fontSize['2xs']`, `radius.full`, `status-dot-size`).
- Evidence: grep for px, weight and line-height literals across src CSS. Read antd.ts in full.

### S13 Component tokens: 53 of 79 are density-invariant and used by one module, so they add public surface without being themable
- Where: src/tokens/component.ts:28-140 (e.g. src/tokens/component.ts:87 sparkline-*, src/tokens/component.ts:97 segmented-bar-*, src/tokens/component.ts:104 progress-*, src/tokens/component.ts:111 stream-cursor-*, src/tokens/component.ts:115 markdown-quote-bar-width, src/tokens/component.ts:117 tool-calls-icon-size, src/tokens/component.ts:82 command-palette-*, src/tokens/component.ts:55 code-height-*), src/theme/compile.ts:502-509, src/components/charts/heatmap.module.css:24, src/components/charts/tooltip.module.css:13
- Kind: simplify
- Impact: low-medium. `compileTheme` writes component tokens after `tokenOverrides` (compile.ts:507-508), so themes cannot change them. Yet each one is a documented global variable, so renaming any of them is a breaking change, and every theme or density switch re-injects about 80 extra properties. Some modules borrow unrelated tokens: the heatmap legend width is `grid-column-sm` and the chart tooltip max-width is `grid-column-lg - space-5`, so retuning Grid columns would silently resize charts.
- Effort: M
- Breaking: yes
- Proposal: Keep in `componentTokens` only the values that vary with density or are shared across modules or with consumers: control heights, page widths, split asides, popup padding, drawer insets, chat widths, data-table sizes. Move per-component internals (sparkline, segmented-bar, progress, stream-cursor, markdown quote bar, tool-calls and source icons, command palette, code heights, state icon) to local custom properties on the component root. Give the heatmap and tooltip their own named values.
- Evidence: scripted comparison of `componentTokens('comfortable')` with `componentTokens('compact')`, then counted the files that reference each token.

### S14 (uncertain) AppShell collapse animates layout, which may jank on WebKitGTK
- Where: src/components/app-shell.module.css:56, src/components/app-shell.module.css:125-150, ResizeObserver users src/components/data-table/DataTable.tsx:675, src/components/data-table/DataTable.tsx:694, src/components/ImageGrid.tsx:239, src/components/Splitter.tsx:165, src/components/Nav.tsx:420
- Kind: webkit
- Impact: uncertain, possibly medium. Collapsing or expanding the sidebar transitions `grid-template-columns` over 280 ms. The main column relayouts on every frame, and every ResizeObserver in the page (DataTable measure, ImageGrid columns, Splitter, Nav) fires per frame and sets React state. base.css:121-125 moved the Switch off a layout animation for exactly this reason (main-thread layout stalls), and WebKitGTK's main-thread layout and compositing are typically slower than Chromium's.
- Effort: M
- Breaking: no
- Proposal: Measure first in the Tauri app with a DataTable page and the WebKit inspector timeline. If it drops frames, move the sidebar with `transform` or `clip-path` and change the column width in one step (before expanding, or after the collapse `transitionend`). Alternatively, debounce the ResizeObserver work in DataTable and ImageGrid to `requestAnimationFrame`.
- Evidence: read the app-shell grid rules and grepped for ResizeObserver. Not measured.

### S15 Window-drag and titlebar CSS is inert under Tauri on WebKitGTK
- Where: src/base.css:807-825, src/components/message.module.css:25-27, src/components/app-shell.module.css:181-189, src/components/file-preview/file-preview.module.css:22-24, src/components/file-preview/file-preview.module.css:35-44, src/theme/compile.ts:432-439
- Kind: webkit
- Impact: low. `app-region` and `-webkit-app-region` are Chromium/Electron (and PWA Window Controls Overlay) features. `env(titlebar-area-*)` exists only with Window Controls Overlay. In WebKitGTK they are ignored or fall back to 0. Tauri 2 drags through the `data-tauri-drag-region` attribute instead. Nothing breaks, but FilePreview's titlebar drag strip (`.root::before`) does not drag the window in the main consumer, and the comments suggest it does.
- Effort: S
- Breaking: no
- Proposal: State in the CSS comments and the AppShell and FilePreview docs that under Tauri the shell must set `--vl-titlebar-height` and `--vl-titlebar-inset-*` itself, and that dragging needs `data-tauri-drag-region` on an element the app owns. Optionally expose a prop or data hook on the FilePreview titlebar strip so the app can add that attribute.
- Evidence: read every `app-region` and `env(titlebar-area…)` use. I did not open the consumer app (out of scope by instruction).

---

## Leave as is

1. **The spring compiler (`src/tokens/spring.ts`) and its fallback (`src/base.css:918-927`).** The `linear()` easing is generated from damped-spring physics, simplified with RDP, and its duration comes from the settle time. It is small, correct, has an `@supports` fallback, and is the right abstraction (a theme only gives `response` and `damping`).
2. **Drawer motion (`src/components/overlays.module.css:61-107`, `src/components/overlays.tsx:277-304`).** A custom `motionName`, transitions that are always on, `@starting-style` for entry and a leaving class for exit. This is the reference implementation that S1, S7 and S11 should copy.
3. **Density through component tokens only.** No `[data-vl-density]` selector exists in any CSS. Density changes `componentTokens` plus the `compactSpacing` algorithm (`src/theme/antd.ts:25-31`), which keeps antd's tighter spacing without its 12 px text or 24 px controls.
4. **The OKLCH pipeline and contrast enforcement** (`src/tokens/oklch.ts`, plus `readable`, `meterTokens` and `chartTokens` in `src/theme/compile.ts`). Grays get the hue `none` for correct `color-mix`, and text and meter colors are checked against WCAG at compile time. compile.ts is not more complex than it needs to be: about 250 of its 541 lines are logic and the rest is TSDoc. Its real complexity is the duplication with antd.ts (S5), not its own structure.
5. **The `data-vl-state` state layer (`src/base.css:7-68`) and token discipline in the modules.** One shared hover and press layer that never scales and gets instant press feedback, specificity 0 through `:where`. Apart from `base.css:836` (S12), there are no literal colors, durations or easings in any module. Extend this (S6, S9) rather than redesign it.
