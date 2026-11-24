# vellum-ui architecture and public API review

Reviewer: **codex-architecture**. Read-only review of the repository, 2026-11-24. Findings are ranked by expected payoff relative to effort. Breaking changes are permitted in these proposals, as requested.

The public surface is generally coherent: own prop types, ISO values, semantic tones and deliberately restricted styling are sound choices. The most valuable work is making those contracts true at runtime, repairing the API snapshot, and narrowing a few dependency boundaries. A wholesale directory rename or antd replacement is not justified.

Evidence and limits:

- Read `AGENTS.md` and `CONTRIBUTING.md`, the root exports and API report, build/package configuration, and the implementations cited below. No repository files were changed; no library build, generated-document update, install, or test suite was run.
- Bundled tiny consumers of the **existing `dist/` snapshot** with installed Rolldown, entirely under `/tmp/vellum-review/codex-architecture/`. React, React DOM and their subpaths were external; JavaScript was minified, `NODE_ENV` was production, and dependency CSS was omitted from the JS measurements. These are isolated entry costs, **not additive incremental costs in an already themed application**.
- The existing distribution predates some source changes: for example, its root has no FilePreview export. Numbers below describe that snapshot, not a newly built version of current source. Full probe code, output module lists and results are in the scratch directory.
- A focused type probe against current source passed with the repository's TypeScript CLI. No browser reproduction was performed; WebKitGTK 2.52 behavior was not independently certified. Refactor proposals must preserve the current visual design, token-driven interruptible motion, reduced-motion behavior and bilingual TSDoc; visual changes still require the prescribed screenshots.

| Isolated export from existing dist | Entry JS, KiB | Entry gzip, KiB | Relevant observation |
| --- | ---: | ---: | --- |
| Text | 0.6 | 0.4 | No antd, ECharts, X or Lucide icon modules retained |
| useTheme | 20.1 | 7.4 | Five dayjs-related modules retained |
| Icon | 56.5 | 12.3 | All 118 registered Lucide icon modules retained |
| Divider | 112.9 | 40.0 | 188 output modules for a separator |
| Checkbox | 130.3 | 46.5 | antd infrastructure retained |
| ThemeProvider | 173.0 | 63.5 | antd theme/configuration and platform locales |
| App | 324.6 | 102.4 | antd message and notification implementations retained |
| Markdown | 2.2 | 1.1 | Renderer remains in asynchronous chunks |

The existing aggregate stylesheet is 203,744 bytes, or 49,487 bytes gzip. The chart probe produced five JS chunks; the Markdown probe produced three. ECharts and XMarkdown were absent from the Text probe.

### ARCH-01 The API snapshot omits most inherited prop contracts

- Where: `scripts/api-report.ts:102`, `etc/vellum-ui.api.md:189`, `etc/vellum-ui.api.md:622`, `etc/vellum-ui.api.md:1003`, `src/components/basic.tsx:25`
- Kind: dx
- Impact: high — many breaking prop, mode and icon-name changes cannot appear in the committed API report, defeating its principal review purpose.
- Effort: M (half a day)
- Breaking: no
- Proposal: Extend the report with the reachable package-local type definitions or a canonical resolved shape for each public props type and union mode. Keep the required unexported OwnProps interfaces; they do not need to become root exports. Include literal keys behind types such as IconName. Add a focused guard proving that a change to an inherited prop or union member changes the snapshot.
- Evidence: ButtonProps is reported only as `extends ButtonOwnProps, Omit<NativeProps<...>>`; neither ButtonOwnProps nor NativeProps is defined in the report. DatePickerProps has the same problem. SelectProps and InputNumberProps refer to omitted private mode declarations. IconName is just `keyof typeof registry`, with no registry declaration. API Extractor's forgotten-export diagnostic is explicitly suppressed. Changing the fields inside these private declarations therefore leaves their reported public signatures unchanged. `docs:check` still provides a separate documentation-consistency gate; this finding concerns the advertised API-diff gate. No forbidden antd/rc/dayjs imports were found in the current API report.

### ARCH-02 Checkbox and Radio promise DOM refs but return rc handles

- Where: `src/components/choice.tsx:85`, `src/components/choice.tsx:141`, `src/components/choice.tsx:220`, `src/components/choice.tsx:296`, `node_modules/antd/es/checkbox/Checkbox.d.ts:58`, `node_modules/antd/es/radio/interface.d.ts:7`
- Kind: bug
- Impact: high — correctly typed consumers receive a handle instead of HTMLInputElement, so native operations such as reading checked, using validity APIs or calling setCustomValidity fail.
- Effort: M (half a day)
- Breaking: no
- Proposal: Destructure and bridge the ref explicitly to the underlying handle's `input`, including Radio.Button. Keep all rc types private. At these boundaries, replace whole-object Loose casts with privately typed adapter props so the compiler checks the conversion rather than accepting the incorrect ref unchanged.
- Evidence: Both public ref properties are `Ref<HTMLInputElement>`. CheckboxRoot spreads the remaining props, including ref, directly into AntCheckbox; RadioRoot and RadioButton do the same with AntRadio. antd declares CheckboxRef/RadioRef from `@rc-component/checkbox`; the installed rc implementation constructs an object containing `focus`, `blur`, `input` and `nativeElement` with useImperativeHandle. Switch was checked separately and its antd ref really is HTMLButtonElement. The scratch source type probe confirms native input refs are accepted by the public Checkbox and Radio props.

### ARCH-03 A successful shared lazy retry leaves sibling charts failed

- Where: `src/components/lazy.ts:69`, `src/components/lazy.ts:77`, `src/components/lazy.ts:86`, `src/components/charts/engine.tsx:57`, `src/components/charts/engine.tsx:369`
- Kind: bug
- Impact: medium — after a shared engine-load failure, retrying one chart can recover the module while other charts continue displaying an error indefinitely.
- Effort: S (<1h)
- Breaking: no
- Proposal: Derive failure as `value === null && failed`, or reset per-subscriber failure when a loaded value becomes available. Preserve the existing shared promise and retry behavior. Verify the specific case of two subscribers failing together and only one retrying successfully.
- Evidence: lazy.load caches one shared value and notifies every subscriber on success. useLazy keeps `failed` separately in each hook instance; only that instance's retry clears it. Two LineCharts sharing the loader therefore both retain failure after rejection, but only the retried hook clears its flag. ChartPlot checks `failed` before rendering its chart, even when its shared engine value has subsequently loaded. This is a code-path proof, not a browser reproduction.

### ARCH-04 Select accepts object values that its adapter cannot preserve

- Where: `src/components/select.tsx:90`, `src/components/select.tsx:328`, `src/components/select.tsx:354`, `src/components/select.tsx:362`, `node_modules/antd/es/select/index.d.ts:1`
- Kind: bug
- Impact: medium — the generic public contract accepts selections that lose their value or produce callback values inconsistent with the declared type.
- Effort: M (half a day)
- Breaking: yes
- Proposal: Introduce the library's own primitive option-value type, initially `string | number`, and constrain Select's option, props and component generics consistently. Apply the same review to TreeSelect and Cascader before narrowing them. Consumers should keep domain objects in their own lookup keyed by these IDs. Use privately checked antd props at the conversion point instead of erasing the generic contract with Loose and unknown callback casts.
- Evidence: The source type probe successfully compiled `SelectProps<{id: string}>` with an object as both option value and selected value, and an onChange handler treating its argument as that object. Select forwards these objects unchanged. The installed rc-select defines RawValueType as string or number and interprets object input as a label/value wrapper: convert2LabelValues reads `val.label` and `val.value`; `{id: ...}` therefore becomes an undefined raw value. Its callback returns the raw value, and vellum converts undefined into null. Segmented already demonstrates the intended primitive constraint at `src/components/choice.tsx:497`. This finding is proven for Select; equivalent failures for every other generic picker are **uncertain** until individually checked.

### ARCH-05 App mounts two unused antd feedback systems

- Where: `src/components/message.tsx:7`, `src/components/message.tsx:351`, `src/components/feedback.tsx:332`, `node_modules/antd/es/app/App.js:52`
- Kind: simplify
- Impact: medium — the standard application wrapper retains and initializes antd message and notification machinery even though vellum's message implementation is its own.
- Effort: M (half a day)
- Breaking: no
- Proposal: Replace AntApp with a narrow private modal context backed by AntModal.useModal and its holder, and have useConfirmDanger read that context. Preserve the existing vellum App and useMessage API, its owned message store, any necessary root styling, and nested-App behavior. Nested Apps can reuse both outer services instead of creating another set of antd holders.
- Evidence: The only source call to AntApp.useApp is useConfirmDanger, which reads `modal`; declarative Modal and Popconfirm do not read AntApp's context. AntApp calls useMessage, useNotification and useModal unconditionally and renders all three holders. vellum mounts AntApp even in its nested-App branch. The isolated App bundle retains antd's message, notification and rc-notification modules and costs 324.6 KiB minified. The exact saving from the narrower bridge is **uncertain** without implementing it; these costs overlap with other controls and are not an additive saving for every application.

### ARCH-06 Move theme readers into a dependency-free context module

- Where: `src/theme/ThemeProvider.tsx:5`, `src/theme/ThemeProvider.tsx:185`, `src/theme/ThemeProvider.tsx:194`, `src/theme/ThemeProvider.tsx:276`, `src/components/data-table/DataTable.tsx:499`, `src/components/file-preview/FilePreview.tsx:777`, `src/components/charts/engine.tsx:156`
- Kind: refactor
- Impact: medium — lightweight theme reads are coupled to platform locale initialization, and viewer-background changes invalidate unrelated table and chart subscribers.
- Effort: M (half a day)
- Breaking: no
- Proposal: Put context definitions and read hooks in a small module with only React and type imports; keep antd/dayjs/platform locale setup in the provider/adapter layer. Give internal consumers separate stable contexts for density, compiled theme variables and viewer stage. Preserve the public useTheme facade by combining those contexts there.
- Evidence: useOptionalTheme and useTheme currently live beside antd imports, dayjs locale registration and top-level platform-locale interop calls. The existing isolated useTheme bundle retains five dayjs-related modules. DataTable reads only density, ChartPlot reads cssVars, and Viewer reads viewerStage, but all subscribe to the same ThemeContextValue object. That object is recreated when viewerStage changes, so switching a viewer background also rerenders mounted tables and chart hosts. Extracting this real dependency boundary is more useful than renaming broad component files.

### ARCH-07 Replace the lowest-behavior antd presentation wrappers first

- Where: `src/components/display.tsx:631`, `src/components/display.tsx:695`, `src/components/display.tsx:162`, `src/components/display.tsx:176`, `src/components/basic.tsx:228`, `src/theme/antd.ts:249`
- Kind: simplify
- Impact: medium — simple separators, event lists and metadata layouts can shed antd configuration/style machinery and awkward composition rules while retaining their current public purpose.
- Effort: M (half a day)
- Breaking: yes
- Proposal: Start with Divider and BuiltinEmpty as native markup styled with existing tokens, then move Timeline to a semantic list and Descriptions to a native description list. For Descriptions, select one data representation (`items`) and remove the inert Item-marker/static-member path. Preserve the current visuals and any separator/list semantics; do not extend this rewrite to complex pickers or Form merely for uniformity.
- Evidence: Divider only forwards plain and children. Timeline only maps event keys, content and tone to AntTimeline. BuiltinEmpty supplies vellum's own artwork and localized text to AntEmpty. Descriptions supports both items and children, although its child component is never rendered; its public documentation must explain that wrapping an Item in another component fails. An isolated Divider export in the existing distribution retains 188 modules / 112.9 KiB minified. In applications already using antd's theme infrastructure, the incremental byte saving will be smaller; removal of wrapper and style coupling remains the main payoff. The breaking part is removing Descriptions.Item, not rewriting the implementation.

### ARCH-08 The name-based icon registry prevents per-icon tree-shaking

- Where: `src/components/Icon.tsx:6`, `src/components/Icon.tsx:136`, `src/components/Icon.tsx:272`, `src/components/Icon.tsx:348`, `src/components/basic.tsx:149`, `src/components/Extras.tsx:129`
- Kind: perf
- Impact: high — any standard icon-bearing control retains the entire registered icon collection, and every added registry entry grows those consumers.
- Effort: L (days)
- Breaking: yes
- Proposal: Give library internals statically imported icon components/definitions, with the same size, stroke and token styling. Expose library-owned icon definitions or components for statically known consumer icons, and accept that own type or a renderable icon slot on controls. Keep the string-name registry as a separate opt-in entry for genuinely data-driven menus and icon pickers; the core icon path must not import it. Derive the public icon-name type from a names-only declaration rather than an inferred map of Lucide components.
- Evidence: Icon selects `registry[name]` dynamically, and the registry contains every imported icon. Button and IconButton route their icons through it. The isolated existing Icon bundle retains all 118 icon modules (56.5 KiB minified / 12.3 KiB gzip); Button, App and chart probes also retain all 118. Current source registers additional icons. Existing Icon declarations also carry the inferred registry and a LucideIcon import solely to express the name union. This is not a claim that all of lucide-react is bundled: it is the complete registered subset.

### ARCH-09 Own the three small AI shells and remove @ant-design/x

- Where: `src/components/ai/Reasoning.tsx:100`, `src/components/ai/ToolCalls.tsx:126`, `src/components/ai/PromptInput.tsx:196`, `src/components/ai/PromptInput.tsx:481`, `src/components/ai/reasoning.module.css:47`, `src/components/ai/tool-calls.module.css:75`, `package.json:102`
- Kind: simplify
- Impact: medium — removing this dependency removes a substantial adapter/override layer and the mandatory installation of unused Mermaid and syntax-highlighter dependencies.
- Effort: L (days)
- Breaking: no
- Proposal: Implement Reasoning with an owned accessible disclosure and ToolCalls with an owned list of disclosures; preserve interruptible height motion and reduced motion. Replace Sender in PromptInput with the existing textarea/autosize facilities and vellum's already-owned header, footer and submission behavior. Once all three uses are gone, delete x-interop and the @ant-design/x dependency. Retain @ant-design/x-markdown as a separately assessed parser dependency.
- Evidence: These are the only three runtime imports of @ant-design/x. Reasoning and ToolCalls replace X's icons, labels and expand affordances, own their state, and insert buttons to repair X's non-keyboard-operable clickable headings; CSS then hides and overrides X internals. PromptInput supplies a custom TextArea solely to forward accessibility attributes and supplies its own action/attachment UI; Sender's remaining jobs are textarea layout, ref and paste plumbing. The installed X manifest hard-depends on mermaid and react-syntax-highlighter (`node_modules/@ant-design/x/package.json:90`). Existing probes retain 18/21/39 X modules for Reasoning/ToolCalls/PromptInput respectively. Deep imports already keep Mermaid out of those JS bundles, so the Mermaid payoff is installation footprint, not a claimed runtime-bundle saving.

### ARCH-10 Feature dependencies need actual package boundaries to become optional

- Where: `package.json:37`, `package.json:64`, `package.json:101`, `src/index.ts:13`, `src/index.ts:92`, `scripts/build.ts:35`, `scripts/build.ts:49`, `src/styles.css:4`
- Kind: refactor
- Impact: medium — core-only consumers must install every chart and AI dependency and load one aggregate component stylesheet despite the existing runtime lazy loading.
- Effort: L (days)
- Breaking: yes
- Proposal: Add explicit core, charts and AI entry points and declarations, with a core entry that does not re-export the heavy features. After ARCH-09, make ECharts and the Markdown renderer optional peers behind their feature entries, or put those integrations in separate packages. Keep an aggregate entry/style import for consumers choosing the complete library; emit optional feature CSS plus core/base CSS so small consumers can avoid it. A metadata-only optional-peer change is insufficient while the same root still traverses every feature.
- Evidence: Both development and published exports expose one JS/type root; feature subpaths are unavailable. That root re-exports every chart and AI component. ECharts and both X packages are hard dependencies even though runtime loaders defer chart/Markdown execution. The build externalizes dependencies but has a single library input and merges component CSS into styles.css; package sideEffects correctly preserves that CSS. The fixed aggregate stylesheet is 199.0 KiB / 48.3 KiB gzip in the existing output. The consumer bundler resolved the Markdown renderer's dependency CSS even for an eventually tree-shaken Text-only graph, illustrating why optional installation needs separated resolution boundaries. Actual downstream installation and startup savings are **uncertain** because no consumer dependency mix or cold-start timing was supplied.

## Leave as is

1. **The ESM build and root barrel's basic tree-shaking strategy.** `scripts/build.ts:35`, `scripts/build.ts:47`, `scripts/build.ts:57` and `package.json:34` correctly externalize dependencies, preserve modules/PURE annotations and retain CSS side effects. The Text probe retains only three modules and 649 bytes of JS. File names such as basic/display/Extras are not, by themselves, a performance defect. Reorganize at the specific boundaries above, not every file.
2. **The chart and Markdown lazy-loading model.** `src/components/lazy.ts:22`, `src/components/charts/engine.tsx:49`, `src/components/charts/engine.tsx:59`, `src/components/ai/Markdown.tsx:27` provide shared loading, retry and SSR/hydration snapshots; chart engines are modular and the Markdown fallback immediately displays escaped text. Repair ARCH-03 without replacing this with another general loading framework.
3. **The small shared adapter vocabulary.** `src/components/internal.ts:10`, `src/components/internal.ts:18`, `src/components/internal.ts:24` centralize size conversion, native-attribute boundaries and injected class merging in 36 lines. These helpers are appropriately private. Keep the restricted styling API and add explicit conversions at the concrete unsafe adapters rather than inventing a universal wrapper factory.
4. **Complex antd-backed inputs, Form and the theme mapping as a strategy.** `src/components/date.tsx:147`, `src/components/form.tsx:369`, `src/components/form.tsx:417`, `src/theme/antd.ts:25` contain meaningful ISO conversion, own validation semantics and carefully adapted density. These are not equivalent to the thin presentation wrappers in ARCH-07. Native ref/value bugs and unused provider services do not justify rewriting date selection, validation or all theme algorithms.
5. **The intentional own public API and documentation schema.** `src/index.ts:402`, `src/docs.ts:123`, `scripts/docs.ts:1098`, `src/components/layout.tsx:31` make the component-doc JSON deliberately consumable and consolidate overlapping antd concepts into Pill, Panel, CountBadge, StatusDot and other own names. Those exports and the primitive/theme utilities have documented purposes; hiding them or adding compatibility aliases offers no demonstrated payoff. Keep bilingual TSDoc as the source of truth.
