# Component logic review — codex-components

Reviewed the requested top-level `src/components/` files, after reading `AGENTS.md` and `CONTRIBUTING.md`. No repository files were changed. Findings are ranked by expected impact relative to implementation effort. Breaking proposals are intentional; they do not depend on preserving historical API behavior.

Evidence includes code inspection, installed dependency inspection, and an isolated browser reproduction file under `/tmp/vellum-review/codex-components/`. Its final run had 10 failing defect assertions and one passing nested-modal control case. These are deliberately added reproduction assertions, not failures in the repository's existing suite. Full results: `/tmp/vellum-review/codex-components/browser-results.txt`; source/config: `review.browser.test.tsx` and `vitest.config.ts` in the same directory. The browser was system Chromium; WebKitGTK 2.52 was not executed. Proposed fixes use ordinary React, JavaScript and DOM APIs and still need the project's WebKitGTK validation. No full checks, build, generation, formatting or installation were run.

### CC-01 Preserve controlled empty values in selection adapters
- Where: src/components/select.tsx:366, src/components/select.tsx:608, src/components/pickers.tsx:541
- Kind: bug
- Impact: high — a control declared as `value={null}` accepts and displays an internal selection even when its parent rejects the change.
- Effort: S (<1h)
- Breaking: no
- Proposal: Preserve an explicitly supplied `null` when forwarding a single-selection value; use a controlled empty array where a multiple-selection backend requires it. Reserve `undefined` for an actually uncontrolled prop. Apply the same policy to Select, TreeSelect and Cascader, preferably through one small normalization helper. Correct the misleading comment that antd requires `undefined` to display a placeholder.
- Evidence: With `<Select value={null} allowClear ...>` and an `onChange` spy that never updates the prop, keyboard selection of Apple calls the spy and leaves Apple displayed. The installed `@rc-component/util` `useControlledState` chooses internal state whenever `value === undefined`; Select's installed implementation explicitly handles `null` as a placeholder value. TreeSelect and Cascader use that same state helper and the wrappers perform the same lossy conversion.

### CC-02 Stop full-data work during virtualized scrolling
- Where: src/components/VirtualList.tsx:75, src/components/VirtualList.tsx:80, src/components/ImageGrid.tsx:247
- Kind: perf
- Impact: high — scrolling a virtualized list rebuilds measurements for every item, and captionless grids scan their entire dataset on rerenders.
- Effort: S (<1h)
- Breaking: no
- Proposal: Memoize VirtualList's `getItemKey` adapter with dependencies on `items` and `getKey`, so internal scroll rerenders preserve its identity. Memoize ImageGrid's `items.some(...)` caption flag by `items`, then derive the height adjustment from that flag, placement and gap.
- Evidence: A stable, instrumented `getKey` supplied to a 1,000-item VirtualList was called 1,020 times for one 500 px scroll after initial rendering had settled and its call counter was reset. The installed TanStack core includes `getItemKey` identity in `getMeasurementOptions` and rebuilds the item measurement array when it changes. ImageGrid's full-array `.some` is directly in the render body; with no captions it visits every item on each virtualizer-triggered render. This is a work-count measurement, not a claimed frame-time benchmark.

### CC-03 Exclude CSS-hidden elements from the dialog tab order
- Where: src/components/FocusScope.tsx:31, src/components/FocusScope.tsx:44, src/components/FocusScope.tsx:98
- Kind: a11y
- Impact: high — a hidden first control can leave keyboard users stuck on the last visible control of a dialog.
- Effort: S (<1h)
- Breaking: no
- Proposal: Filter candidates using computed `visibility` as well as layout rectangles and hidden/inert ancestors, and exclude actually disabled controls even when they also carry `tabindex`. Keep the existing portal-ownership traversal. Make the visibility/focusability predicate reusable by popup focus code rather than adding another selector-only approximation.
- Evidence: Rendered a Modal with a `visibility:hidden` button followed by two visible buttons. After focusing the last visible button and pressing Tab, focus remained there instead of wrapping to the first visible button. The hidden button has a client rectangle, passes `visible()`, and becomes the chosen first element; its `focus()` does nothing. CSS visibility is also the documented mechanism for hiding collapsed content in the motion guide.

### CC-04 Adapt Checkbox and Radio refs to their declared native elements
- Where: src/components/choice.tsx:85, src/components/choice.tsx:141, src/components/choice.tsx:220, src/components/choice.tsx:296, src/components/choice.tsx:300
- Kind: bug
- Impact: medium — consumers receive objects without native input properties and methods despite a public `Ref<HTMLInputElement>` contract.
- Effort: S (<1h)
- Breaking: no
- Proposal: Capture the internal antd checkbox/radio handle and forward its actual `.input` element through a small internal adapter used by Checkbox, Radio and Radio.Button. Keep dependency-specific handle types private.
- Evidence: Both Checkbox and Radio browser ref assertions failed `instanceof HTMLInputElement`; the actual values contained `focus`, `blur`, `input` and `nativeElement`. The installed checkbox implementation constructs exactly that handle with `useImperativeHandle`, and the wrappers pass `ref` through the `Loose` spread unchanged. Calling native methods such as `ref.current.addEventListener(...)` therefore fails; reading `.checked` does not read the input.

### CC-05 Preserve React 19 callback-ref cleanup in Form
- Where: src/components/form.tsx:332, src/components/form.tsx:342, src/components/form.tsx:366
- Kind: bug
- Impact: medium — resources attached by a consumer's callback ref are never cleaned up when a validated field unmounts or its composed ref changes.
- Effort: S (<1h)
- Breaking: no
- Proposal: Replace `mergeInjected`'s ref loop with a React 19-aware ref composition helper. Collect cleanup functions returned by callback refs and invoke them during detachment; clear object refs and invoke `ref(null)` only for callbacks without a cleanup. Reuse this helper anywhere else native refs need composition.
- Evidence: Mounted a named Form.Item with rules and a native input whose callback ref returns a cleanup spy. Unmounting the form never called the cleanup. `mergeInjected` invokes each callback but discards its return value, and its own callback returns nothing, so React cannot run the consumer's cleanup. The named/rules path selects ErrorProbe and exercises the composition rather than the plain Form.Item path.

### CC-06 Reposition Nav's indicator when its items change
- Where: src/components/Nav.tsx:283, src/components/Nav.tsx:410, src/components/Nav.tsx:419
- Kind: bug
- Impact: medium — changing or regrouping navigation items can leave the selected background behind a different item.
- Effort: S (<1h)
- Breaking: no
- Proposal: Pass the item collection into `useIndicator` and recompute placement when its identity changes, even if the selected key and the overall navigation dimensions are unchanged. Preserve animation for selection changes and use immediate placement for structural changes.
- Evidence: Rendered `[Apple, Banana]` with Banana current, then rerendered `[Banana, Apple]` with the same current key. After layout and observer delivery, the indicator still had `translate(0px, 38px)`. Effects only observe `value` and `collapsed`; ResizeObserver explicitly ignores callbacks when the root width and height remain equal, which a same-size reorder preserves.

### CC-07 Make InlineEdit's numeric representation explicit
- Where: src/components/InlineEdit.tsx:79, src/components/InlineEdit.tsx:193, src/components/InlineEdit.tsx:289, src/components/InlineEdit.tsx:338, src/components/InlineEdit.tsx:410
- Kind: refactor
- Impact: high — clearing a numeric field changes subsequent saves from numbers to strings without a public type change.
- Effort: M (half a day)
- Breaking: yes
- Proposal: Replace runtime inference from the current value with discriminated props: text uses strings, numeric mode explicitly chooses number or decimal string through a `decimal` flag consistent with InputNumber, and select uses its option value type. Remove `Session.numeric` and derive conversion from the declared mode. Document both modes in English and Chinese TSDoc.
- Evidence: `<InlineEdit<number> type="number" value={null} ...>` saved `"12"`, not `12`, after entering 12 and pressing Enter. `numeric` is initialized with `typeof shown === 'number'`, so a number-valued field becomes a string-valued field after a save clears it to null. The unconstrained relationship between generic `V` and `type` also permits a number-typed text editor. Explicit representation removes this inference and associated casts rather than adding another state synchronization effect.

### CC-08 Constrain Select's generic to supported option keys
- Where: src/components/select.tsx:90, src/components/select.tsx:328, src/components/select.tsx:354
- Kind: dx
- Impact: medium — TypeScript currently accepts object-valued selections that the wrapped selection engine interprets incorrectly and renders empty.
- Effort: S (<1h)
- Breaking: yes
- Proposal: Define a library-owned `SelectValue = string | number` type and constrain Select, its option/group types and its props variants to it. Require applications to use stable scalar IDs for objects. Apply corresponding constraints to other selection wrappers only after checking their actual value semantics; do not implement arbitrary object identity support to preserve this accidental promise.
- Evidence: A browser reproduction using `<Select<{id:string}> value={a} options={[{value:a,label:'Apple'}]} />` displayed no Apple label. This usage is accepted by the current public generic. The installed Select implementation distinguishes raw values from objects and treats an object value as a labeled-value record, reading `.value` rather than the supplied object's identity. This is independent of the null conversion defect.

### CC-09 Give destructive confirmation input a programmatic label
- Where: src/components/feedback.tsx:296, src/components/feedback.tsx:301, src/components/feedback.tsx:302
- Kind: a11y
- Impact: medium — the textbox that gates an irreversible action has no accessible name or associated instruction.
- Effort: S (<1h)
- Breaking: no
- Proposal: Give the input an ID from `useId` and render the existing localized "type to confirm" instruction as its associated label. If a shorter name is desired, associate the instruction separately with `aria-describedby`. Keep the label and instruction generated from the existing bilingual text source.
- Evidence: Opened `useConfirmDanger` with `confirmText: 'Atlas'`; the textbox failed the browser accessible-name matcher with an empty received name. Its preceding instruction is a plain div, and the Input receives neither a label association nor ARIA naming/description attributes. Existing tests locate this field by test ID, which does not verify its accessible name.

### CC-10 Make message closing safe against callback reentry
- Where: src/components/messageStore.ts:115, src/components/messageStore.ts:121, src/components/messageStore.ts:124, src/components/messageStore.ts:135
- Kind: bug
- Impact: medium — reopening the same keyed message inside `onClose` produces a visible replacement that is then deleted by the old close operation.
- Effort: S (<1h)
- Breaking: no
- Proposal: Finish registering removal state/timers before calling the consumer's `onClose`, so `open` can cancel the old teardown. Alternatively guard teardown with an entry generation. Keep callbacks outside partially completed store mutations.
- Evidence: A direct Node reproduction opened key `job` with `durationMs:0` and an `onClose` that reopened `job` with replacement content and `durationMs:0`. Immediately after close, the snapshot showed the replacement with `leaving:false`; after the old removal delay, the snapshot was empty. `leave()` currently calls `onClose` before assigning `removeTimer`, so `open()` cannot cancel the timer that has not yet been created. Reproduction and output are in `pure-repro.mjs` and `pure-results.txt` under the scratch directory.

### CC-11 Tie message presence to its actual exit transition
- Where: src/components/messageStore.ts:69, src/components/messageStore.ts:122, src/components/message.tsx:336, src/components/message.module.css:46, src/components/message.module.css:51
- Kind: consistency
- Impact: medium — custom motion durations cut message exits short, and replacing an entry during entry/exit restarts one-shot animation instead of continuing from its current position.
- Effort: M (half a day)
- Breaking: no
- Proposal: Let MessageHost/MessageItem report completion of a token-driven exit transition to the store, with a fallback timer derived from the computed duration and immediate removal for reduced motion. Replace one-shot entry/exit keyframes with the existing motion-guide transition pattern; preserve the separate FLIP positioning behavior. Cancel pending removal when a keyed message returns. This also removes the duplicated assumption that every theme exits in 140 ms.
- Evidence: Set `--vl-motion-duration-base` to `1000ms`, closed a message, and verified its computed exit animation was `0.7s`; it had nevertheless been removed by 180 ms because App always creates its store with `MESSAGE_DEFAULTS.leaveMs = 140`. The CSS switches between `message-in` and `message-out` animations while the store explicitly permits recalling a leaving entry. AGENTS.md and the motion guide require interruptible transitions and token-based lifecycle timing. The stylesheet was read only as supporting evidence for the scoped message/store logic.

## Leave as is

- **The date/time backend adapters:** `src/components/date.tsx:147`, `src/components/date.tsx:168`, `src/components/date.tsx:193`, `src/components/date.tsx:336` keep the public values as ISO strings and confine Dayjs to the implementation. These are already short adapters; replacing the date engine with custom controls would add substantial calendar/keyboard work.
- **Hotkey registry and key normalization:** `src/components/useHotkeys.tsx:178`, `src/components/useHotkeys.tsx:195`, `src/components/useHotkeys.tsx:305`, `src/components/keys.ts:139` already centralize matching, IME/input exclusions and listener lifetime, with current handlers read through a committed ref. Do not replace them with per-component document listeners.
- **Delayed pending state machine:** `src/components/useDelayedPending.ts:37`, `src/components/useDelayedPending.ts:100` has a small explicit timer state machine, supports minimum visible time and clears its timer on disposal. A more general timer/state framework would not simplify this implementation.
- **Upload request bookkeeping and shared file rules:** `src/components/upload.tsx:335`, `src/components/upload.tsx:348`, `src/components/upload.tsx:398`, `src/components/upload.tsx:419`, `src/components/fileRules.ts:24` have concrete reasons for their request maps, retained IDs, retry cleanup and shared validation. A blanket controlled-state hook would not remove those responsibilities.
- **SelectionBar's focus/inert ordering:** `src/components/SelectionBar.tsx:167`, `src/components/SelectionBar.tsx:203` deliberately enables the incoming layer, transfers focus, then makes the outgoing layer inert, and recovers focus after a focused action disappears. Preserve this sequencing rather than replacing it with a purely declarative inert toggle.
