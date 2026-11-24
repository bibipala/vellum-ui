# Visual review — Chromium vs WebKitGTK (claude-visual)

The visual reviewer took the screenshots but was stopped before writing its report. This summary was compiled by the main
agent from those screenshots on 2026-11-24.

## Method

- The documentation site (`pnpm site:dev`) at 1280×800. 44 page states: about 30 component pages, 8 page recipes and the
  overview, in light and dark mode, plus compact density for a few. Overlays were opened for Drawer, Modal, Select,
  DatePicker, Dropdown, Popover, CommandPalette and FilePreview.
- Each state was shot in Chromium (playwright-core, `/usr/bin/chromium`, headless) and in **WebKitGTK 2.52**: a Python script
  using PyGObject (`gi.require_version('WebKit2', '4.1')`) loaded the page in a WebView under `xvfb-run` and saved a
  snapshot. 88 side-by-side pairs.
- Every pair was ranked by the share of pixels that differ (threshold 40/255 in grayscale), and the pairs with the largest
  differences were inspected, along with the overlays and FilePreview.

| Difference | Pages |
| --- | --- |
| 8–10.5% | Media library recipe, overview, workspace home |
| 5–6% | Dashboard, settings, sign-in, list page recipes; compact DataTable |
| 1–4% | All component pages and overlays (text anti-aliasing level) |
| 0.1% | FilePreview open (identical) |

## Result

**WebKitGTK renders the library essentially the same as Chromium.** In the inspected pairs there were no broken layouts,
missing shadows, wrong colors, misplaced popups or clipped focus rings. Cards stay borderless with their soft shadow, inputs
are filled wells, and dark-mode surfaces separate in both engines. The largest differences come from text wrapping (V1).

### V1 Text is about 1–2% wider in WebKitGTK
- Seen in: `pairs/recipe-medialibrary--light.png`, `pairs/home--dark.png`, `pairs/recipe-dashboard--light.png`
- Kind: webkit-diff
- Impact: low
- Likely cause: font shaping or metrics of Inter Variable differ between the engines. Not investigated.
- Proposal: no change to the text itself. No layout should depend on the exact width of text (see V2).

### V2 Compact DataTable overflows horizontally in WebKitGTK
- Seen in: `pairs/datatable-compact--light.png`: a horizontal scrollbar under the table, with a thumb almost as wide as the
  track, so the overflow is only a few pixels
- Kind: webkit-diff
- Impact: medium. The Tauri app on Linux shows a scrollbar under a table that fits.
- Likely cause: unknown. Possibly column widths that add up exactly to the container width combined with V1. Headless Chromium
  hides scrollbars, so these screenshots cannot show whether Chromium overflows as well.
- Proposal: compare `scrollWidth` and `clientWidth` of the table scroller in both engines. If it overflows, find which column
  width is rounded or measured from text.

### V3 (uncertain) Focused DatePicker input looks different
- Seen in: `pairs/datepicker-open--light.png`. Chromium shows the focused field (surface background and accent line);
  WebKitGTK shows the filled field with a faint ring.
- Kind: webkit-diff
- Impact: unknown. The offscreen WebKit window probably did not have focus, so this is likely an artifact of the harness.
- Proposal: check in the real Tauri app before changing anything.

## Notes for later visual checks

- Headless Chromium hides scrollbars, so scrollbar differences cannot be compared with it. Use headed Chromium or compare
  `scrollWidth` and `clientWidth`.
- The `localStorage` SecurityError in the Chromium logs came from the harness (`addInitScript` also runs on `about:blank`).
  It is not an error in the site.

## Looks good

1. Overlays (Drawer, Modal, Select, DatePicker, Popover, CommandPalette) match in both engines, including their shadows and
   radii.
2. FilePreview's viewer is identical in both engines.
3. The dashboard's statistic tiles and sparklines, and the borderless cards with soft shadows, on light and dark canvases.
4. Filled inputs and selects in light and dark mode.
5. Dark mode: surfaces, selected navigation items and text contrast hold up in WebKitGTK.
