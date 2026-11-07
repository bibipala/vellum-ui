**English** | [简体中文](../../zh-CN/guides/custom-styles.md)

# Custom styles

When an application may write its own CSS next to vellum-ui, and the rules for it: only business-specific visuals that no component covers; design tokens through `var(--vl-…)` for every color, size, radius, shadow and duration; pixel literals limited to `0` and `1px`; no inline `style`; the shared state layer (`data-vl-state`) for custom elements that can be clicked; entrance motion with the library's global keyframes; and the neutral viewer tokens behind images.

## When

Standard pages need no CSS (see [Building pages](building-pages.md)). Write your own CSS only for visuals that belong to your product and that no component offers: a chat bubble of a special kind, a business marker drawn over an image, a seat map, a card on a home page that is laid out in a way of its own.

Before writing CSS, check the [component overview](../README.md): if a component almost fits, use it as it is and ask for the prop you are missing. Do not restyle the components of the library (no selectors on their elements or class names: those are internal and change between versions).

## Rules

1. **Values come from tokens.** Colors, font sizes, font weights, line heights, spacing, radii, shadows, durations and easings are `var(--vl-…)`. Tokens change with light and dark mode, the accent color and the theme; literals do not.
2. **Pixel literals: only `0` and `1px`.** Everything else is a token (`var(--vl-space-3)`, `var(--vl-radius-lg)`), or a relative unit such as `%` or `fr` for proportions.
3. **No `style={…}` in TSX.** Put the CSS in a CSS Module (`*.module.css`) and set the class on your own elements; vellum-ui components take no `className`.
4. **No colors with their own hue.** Use the semantic tokens (`color-accent`, `color-success`, …) and the chart palette (`color-chart-1` … `color-chart-8`) instead of hex values.
5. **Hover and press through the state layer** (below), not with your own `:hover` backgrounds or `:active` scaling.
6. **Motion through the motion tokens**, so that "reduce motion" turns it off.

## Tokens

Every token is a CSS custom property with the prefix `--vl-`, written to the document by ThemeProvider. The [token list](../tokens.md) has all of them with their values; the ones used most:

| Kind | Tokens |
| --- | --- |
| Surfaces | `--vl-color-bg-canvas`, `--vl-color-bg-surface`, `--vl-color-bg-sunken`, `--vl-color-bg-elevated` |
| Fills and borders | `--vl-color-fill`, `--vl-color-fill-strong`, `--vl-color-fill-hover`, `--vl-color-fill-selected`, `--vl-color-border`, `--vl-color-border-strong`, `--vl-border-width` |
| Text | `--vl-color-text-primary`, `--vl-color-text-secondary`, `--vl-color-text-tertiary`, `--vl-color-text-on-accent`, `--vl-color-accent-text` |
| Semantic colors | `--vl-color-accent`, `--vl-color-success`, `--vl-color-warning`, `--vl-color-danger`, `--vl-color-info`, each with `-hover`, `-active`, `-disabled`, `-subtle` (a subtle background); `success`, `warning`, `danger` and `info` also with `-text` (readable as text) |
| Charts | `--vl-color-chart-1` … `--vl-color-chart-8` (with `-on` for text on them), `--vl-color-chart-muted`, `--vl-color-chart-grid`, `--vl-color-chart-axis` |
| Spacing | `--vl-space-0` … `--vl-space-8` (0, 4, 8, 12, 16, 24, 32, 48, 64 px) |
| Type | `--vl-font-size-2xs` … `--vl-font-size-4xl`, `--vl-font-weight-regular`, `-medium`, `-semibold`, `--vl-line-height-body`, `--vl-line-height-heading`, `--vl-font-family-body`, `-heading`, `-mono` |
| Radius | `--vl-radius-sm`, `-md`, `-lg`, `-xl`, `-2xl`, `-full` |
| Shadow | `--vl-shadow-near` (cards, none in dark mode), `--vl-shadow-float` (menus), `--vl-shadow-pop` (dialogs) |
| Motion | `--vl-motion-duration-fast`, `-base`, `-slow`, `--vl-motion-ease-standard`, `--vl-motion-ease-exit` |
| Focus | `--vl-color-focus-ring`, `--vl-color-focus-halo` |
| Layers | `--vl-z-overlay`, `--vl-z-viewer`, `--vl-z-message` |

Names follow the theme: a semantic color `bgSurface` becomes `--vl-color-bg-surface`. The primitive palette (`--vl-neutral-…`, `--vl-blue-…`) is emitted too, but use the semantic tokens: primitives do not change with the mode. Component tokens such as `--vl-control-height-md` follow the density.

In TypeScript, `cssVar('color-accent')` returns `'var(--vl-color-accent)'`, for the places that take a CSS color string, such as the `fill` of an SVG element or the options of a third-party library. `useTheme().cssVars` holds the resolved values of the current theme, for canvases that cannot read CSS variables.

## Clickable custom elements: `data-vl-state`

Give a custom element that can be clicked the attribute `data-vl-state`. It gets the state layer of the library: a layer of the content color that appears on hover and darkens on press (immediately, without scaling), a focus ring on keyboard focus, and nothing while it is `disabled` or `aria-disabled="true"`. On touch screens there is no hover layer.

```tsx
<button type="button" className={styles.entry} data-vl-state="" onClick={open}>
  …
</button>
```

- The state layer is the element's `::before`: do not use `::before` on that element yourself.
- The element becomes `position: relative` and creates a stacking context; the layer inherits its `border-radius`.
- Use a real `<button>` or `<a>` so that the element can be focused and triggered with the keyboard.

## Entrance motion

`vellum-ui/styles.css` defines the keyframes `vl-rise` (fade in and rise by a few pixels), which Page uses. In a CSS Module, reference them as global, or CSS Modules renames them and the animation silently does nothing:

```css
.card {
  /* biome-ignore lint/correctness/noUnknownFunction: global() references keyframes outside the CSS Module */
  animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;
}
```

The comment is for linters that do not know `global()`. Define your own keyframes in the same CSS Module. With "reduce motion" on, the duration tokens are 0, so animations that use them stop. `vellum-ui/global.css` adds `vl-fade-in` and `vl-fade-out` for the page transition (`view-transition-name: vl-main`); they exist only when that stylesheet is imported.

## Behind images: the viewer tokens

Areas that show images or video (a canvas, a viewer, a caption over a thumbnail) use the viewer tokens, not the surface colors: they are neutral gray without any tint, the same in light and dark mode and independent of the accent color, because a tinted background changes how colors in images are perceived.

| Token | Use |
| --- | --- |
| `--vl-viewer-bg-mid`, `--vl-viewer-bg-dark`, `--vl-viewer-bg-black` | The background behind the image (mid gray, dark gray, black) |
| `--vl-viewer-text`, `--vl-viewer-text-muted` | Text on that background |
| `--vl-viewer-control-bg`, `--vl-viewer-control-bg-hover`, `--vl-viewer-control-border` | Controls over the image |
| `--vl-viewer-placeholder` | The placeholder while an image loads |

`useTheme().viewerStage` is the background the user chose for Lightbox (`'mid'`, `'dark'` or `'black'`); follow it in your own viewers.

## Example

A card of a home page that opens a project: a surface, a radius, the state layer and an entrance animation, all from tokens.

```css
/* ProjectCard.module.css */
.card {
  display: flex;
  flex-direction: column;
  gap: var(--vl-space-1);
  padding: var(--vl-space-4);
  border: 0;
  border-radius: var(--vl-radius-xl);
  background: var(--vl-color-bg-surface);
  box-shadow: var(--vl-shadow-near);
  color: var(--vl-color-text-primary);
  font: inherit;
  text-align: start;
  /* biome-ignore lint/correctness/noUnknownFunction: global() references keyframes outside the CSS Module */
  animation: global(vl-rise) var(--vl-motion-duration-slow) var(--vl-motion-ease-standard) both;
}

.accent {
  height: 1px;
  background: var(--vl-color-accent);
}
```

```tsx
import { Text } from 'vellum-ui'
import styles from './ProjectCard.module.css'

export function ProjectCard(props: { readonly name: string; readonly owner: string; readonly onOpen: () => void }) {
  return (
    <button type="button" className={styles.card} data-vl-state="" onClick={props.onOpen}>
      <span className={styles.accent} />
      <Text weight="semibold">{props.name}</Text>
      <Text size="sm" tone="secondary">{props.owner}</Text>
    </button>
  )
}
```

The content uses Text, so the font sizes and colors still come from the library; the CSS only draws what is specific to this card.
