# Option: unify the derived colors (stage 4C, S5)

Status: **not applied.** For the maintainer to decide from the crops below.

Stage 4C moved every derived color into one function, `deriveColors()` (`src/theme/derive.ts`). The CSS
variables (`compile.ts`) and the antd theme (`antd.ts`) both read from it. Where the two old copies disagreed,
`deriveColors()` still returns both values, so nothing changes visually: the plain name is what the library's own
CSS uses, and the `antd…` name is the old antd value. This option removes that duplication.

- Patch: `unify-derived-colors.patch`, produced with `git diff` on top of the stage-4C working tree.
  Apply it with `git apply dev/review/stage-4/unify-derived-colors.patch`; revert it with `git apply -R …`.
- Files: `src/theme/antd.ts` (antd takes the CSS values), `src/theme/derive.ts` (drops `antdPrimaryHover`,
  `antdPrimaryActive`, `antdLinkHover`, `antdLinkActive` and `antdStatusHalo`), `src/components/app-shell.module.css`
  (scrim) and `test/tokens.test.ts` (expects the unified values).
- Checked with the patch applied: lint and typecheck clean; `test/tokens.test.ts` and `test/guards.test.ts` pass
  (49 tests).
- Rule: each drifted pair takes the value the library's own CSS uses, so components rendered by antd and the
  library's own components agree. The AppShell scrim uses `--vl-color-mask`, the color of the Modal and Drawer masks.

## Evidence

Visual harness, `4c-after` (stage 4C) vs `4c-unified` (patch applied):

- All 138 shots are pixel-equal, and computed styles are unchanged at rest: nothing changes until you interact.
- 22 light-mode shots differ in the state sweep (forced hover / press): AppShell, Button, Checkbox, DataTable,
  DatePicker-open, Form, Markdown, MessageList, Modal, Modal-open, Nav, Panel, Radio, Reasoning, Steps, Switch,
  Tabs, TimePicker-open, ToolCalls, Tree, recipe ListPage and recipe SettingsPage. Every line is one of the
  primary-color or link changes below.
- The harness cannot show the rest: it sweeps light mode only, no example uses `variant="outlined"` with a status,
  and it never opens the narrow AppShell drawer. The crops therefore come from the two builds rendered side by side
  in Chromium. States are forced with `CSS.forcePseudoState`, the same way as the harness. Crops are enlarged 2×
  (halos 3×). Left: current; right: unified.

## Per value

| Value | Mode | antd now | Library CSS now | Unified | Crop |
| --- | --- | --- | --- | --- | --- |
| Primary hover (`colorPrimaryHover` vs `--vl-color-accent-fill-hover`) | light | L +0.04, `#3978ff` | L +0.06, `#3e7eff` | `#3e7eff` | `unify-primary-hover-light.png` |
| | dark | L +0.04 (lighter), `#417af1` | L −0.06 (darker), `#255acf` | `#255acf` | `unify-primary-hover-dark.png` |
| Primary press (`colorPrimaryActive` vs `--vl-color-accent-fill-active`) | light | L −0.05, `#1e5ae2` | L −0.08, `#1550d7` | `#1550d7` | `unify-primary-active-light.png` |
| | dark | L −0.05 (darker), `#285dd2` | L +0.08 (lighter), `#4d86ff` | `#4d86ff` | `unify-primary-active-dark.png` |
| Link hover (`colorLinkHover` vs `--vl-color-accent-text-hover`) | light | L −0.06, `#134ac5` | L −0.07, `#1046c1` | `#1046c1` | `unify-link-hover-light.png` |
| | dark | L +0.06, `#97c3ff` | the same | no change | none |
| Link press (`colorLinkActive` vs `--vl-color-accent-text-active`) | light | L +0.04 (lighter), `#306ae7` | L −0.112 (darker), `#0338b3` | `#0338b3` | `unify-link-active-light.png` |
| | dark | L −0.04 (darker), `#79a3f6` | L +0.096 (lighter), `#a2cfff` | `#a2cfff` | `unify-link-active-dark.png` |
| Error focus halo, outlined (`errorActiveShadow` vs base.css) | light | danger at 18 % | danger at 20 % | 20 % | `unify-error-halo-light.png` |
| | dark | danger at 30 % | danger at 20 % | 20 % | `unify-error-halo-dark.png` |
| Warning focus halo, outlined (`warningActiveShadow` vs base.css) | light | warning at 18 % | warning at 22 % | 22 % | `unify-warning-halo-light.png` |
| | dark | warning at 30 % | warning at 22 % | 22 % | `unify-warning-halo-dark.png` |
| AppShell scrim (`--vl-color-shadow` vs `--vl-color-mask`) | light | — | `oklch(20% 0.01 263 / 0.1)` | `oklch(20% 0.02 263 / 0.32)` | `unify-scrim-light.png` |
| | dark | — | `oklch(0% 0 none / 0.55)` | `oklch(10% 0.01 263 / 0.6)` | `unify-scrim-dark.png` |

### Which components change

- **Primary hover and press.** Every antd component that uses `colorPrimaryHover` / `colorPrimaryActive`: Button
  `variant="primary"`, including primary buttons rendered as links (`href`, as in the ListPage recipe); hover on checked Checkbox, Radio,
  Radio.Button and Switch, and on the checkboxes of Tree; hover on clickable Steps titles; the pressed color of Tabs.
  Pagination, the checkable Tag, Upload's drag area and ColorPicker use these tokens as well. Input and Select
  hover borders do not change: they use `--vl-color-border-strong-hover`.
- **Links.** Only links whose colors come from antd: the "Today" / "Now" link in the DatePicker and TimePicker
  panels, and antd's page-wide `a` rule (in the `antd` layer) for links without a color of their own, such as a
  link in the DataTable example. LinkButton and Markdown links already use the CSS values.
- **Status halos.** Input, InputNumber, Select, TreeSelect, Cascader, AutoComplete, DatePicker and TimePicker with
  `variant="outlined"` and `status="error"` / `"warning"`, while focused. The default filled variant does not change:
  it already uses these values. No example uses `variant="outlined"`, so the crops switch the error Input of the
  Input page to the outlined classes, which `variant="outlined"` renders.
- **Scrim.** AppShell's sidebar drawer in the narrow layout (frame narrower than 960 px). The Modal and Drawer
  masks do not change.

## Points to decide

1. **Dark-mode primary buttons would darken on hover and lighten when pressed.** That is the direction of
   `deriveStates()` in dark mode, which `--vl-color-accent-fill-hover` / `-active` (and every `--vl-color-<status>-hover`
   / `-active`) use. antd today does the opposite: hover lighter, press darker. The crops `unify-primary-*-dark.png`
   show the difference. Alternatives:
   - unify in the other direction instead: change `deriveStates()` so the CSS tokens follow antd. That changes
     public tokens, although no component uses them (S8 plans to remove them in 2.0);
   - apply only the link, halo and scrim parts. The primary hunk in `antd.ts` is independent: drop it from the patch.
2. **Status halos in dark mode.** Unified at 20 % / 22 %, the dark error halo stays weaker than the accent halo
   (26 %), as it already is for the default filled inputs. Raising the CSS side instead (for example 30 % in dark
   mode) would change the default inputs too.
3. **Light link press** becomes much darker (`#0338b3`, L −0.112). That is the value LinkButton already uses.

## Not in the patch (noticed while doing this)

- ColorPicker's open trigger (`base.css`) lights up to `--vl-color-bg-surface` in both modes. antd inputs light up
  to `bg-elevated` in dark mode (`activeBg`). It is a small dark-mode drift, not listed in the review.

## If applied: suggested CHANGELOG entry (Changed)

> Ant Design-based components use the library's hover and pressed colors. Primary buttons and other accent-colored
> controls (checked checkboxes, radios and switches, tabs, steps) match `--vl-color-accent-fill-hover` / `-active`; in
> dark mode they darken on hover and lighten when pressed. Links drawn by Ant Design, such as "Today" in the date
> picker, match LinkButton. Outlined inputs in an error or warning state get the same focus halo as the default filled
> inputs. The mask behind AppShell's narrow-layout sidebar uses `--vl-color-mask`, like Modal and Drawer.

## Also in this folder (applied in stage 4C)

`reduced-motion-spinner-light.png` and `reduced-motion-spinner-dark.png` show Loading under "reduce motion": before,
the stopped dots are at 30 %; after, they are opaque. No shot of the visual harness shows this spinner, so it is
rendered from the Loading page of the two builds.
