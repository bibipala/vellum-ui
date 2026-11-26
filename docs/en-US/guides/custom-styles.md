**English** | [简体中文](../../zh-CN/guides/custom-styles.md)

# Custom styles

Use custom CSS for product-specific visuals that existing components do not cover. This guide covers CSS Module boundaries, design tokens, interaction states, page transitions and image-viewing backgrounds to keep custom visuals consistent with the active theme.

## When

Standard pages need no custom CSS (see [Building pages](building-pages.md)). Reserve it for product-specific visuals without an existing component, such as a specialized chat bubble, an image annotation, a seat map or a distinct home-page card layout.

Check the [component overview](../README.md) first. If a component is suitable but lacks an option, use its supported API and request the missing prop. Do not target library elements or class names with CSS selectors; these implementation details may change between versions.

## Rules

1. **Use design tokens.** Reference colors, font sizes, font weights, line heights, spacing, radii, shadows, durations and easing through `var(--vl-…)`. Tokens adapt to the color mode, accent color and theme.
2. **Pixel literals: only `0` and `1px`.** Everything else is a token (`var(--vl-space-3)`, `var(--vl-radius-lg)`), or a relative unit such as `%` or `fr` for proportions.
3. **Use CSS Modules instead of inline styles.** Place styles in `*.module.css` and apply classes to application-owned elements. vellum-ui components do not accept `className`.
4. **Use semantic colors.** Reference semantic tokens (`color-accent`, `color-success`, …) and the chart palette (`color-chart-1` … `color-chart-8`) instead of literal hex values.
5. **Use the shared state layer** for hover and press feedback (see below). Do not add custom `:hover` backgrounds or `:active` scaling.
6. **Use motion tokens** to respect reduced-motion preferences; see [Motion](motion.md) for the principles and how to write motion.

## Precedence over Ant Design: cascade layers

ThemeProvider puts the CSS that Ant Design generates at runtime into the [cascade layer](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer) `antd`. CSS outside any layer takes precedence over CSS in a layer, whatever the specificity of its selectors or the order in which it loads. vellum-ui's own stylesheets are not in a layer, and neither is a CSS Module of yours unless you put it in one: a class of yours always applies to your elements. Only the default keyboard focus ring of vellum-ui (and of every focusable element, with `global.css`) is in a layer, `vellum-defaults`, which comes before `antd` so that the focus styles of the components win over it.

- **Keep global resets out of the components.** A rule outside a layer that targets every element or a tag, such as `* { margin: 0 }` or `button { background: none }`, also overrides the Ant Design-based components inside vellum-ui. Put such resets in a layer declared before Ant Design's:

```css
@layer reset, vellum-defaults, antd;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
  }
}
```

- **Declare the order when you use layers yourself.** Between layers, the one declared later wins. Ant Design creates its layer when it first injects styles, usually after your stylesheets have loaded, so it comes after, and wins over, all of your layers. To place it, declare the order once at the start of your first stylesheet, with `vellum-defaults` before `antd`. With Tailwind CSS v4, for example, this keeps Ant Design above the reset in `base` and below your utilities:

```css
@layer theme, base, vellum-defaults, antd, components, utilities;
```

## The library's stylesheets

Import the stylesheets of vellum-ui once, at the root of the application, before your own. `vellum-ui/styles.css` contains the styles of all components. To leave out the styles of entries you do not use, import `vellum-ui/core.css` instead, then `vellum-ui/charts.css` if you use `vellum-ui/charts` and `vellum-ui/ai.css` if you use `vellum-ui/ai`:

```ts
import 'vellum-ui/core.css'
import 'vellum-ui/charts.css' // with vellum-ui/charts
import 'vellum-ui/ai.css' // with vellum-ui/ai
import './app.css' // your own styles come after
```

`charts.css` and `ai.css` contain only what `core.css` does not, so they always come after it. `styles.css` is the three files in this order: import either `styles.css` or the separate files, not both.

## Tokens

ThemeProvider exposes tokens as CSS custom properties with the `--vl-` prefix. The [token reference](../tokens.md) lists all names and values. Common tokens include:

| Kind | Tokens |
| --- | --- |
| Surfaces | `--vl-color-bg-canvas`, `--vl-color-bg-surface`, `--vl-color-bg-sunken`, `--vl-color-bg-elevated` |
| Fills and borders | `--vl-color-fill`, `--vl-color-fill-strong`, `--vl-color-fill-hover`, `--vl-color-fill-selected`, `--vl-color-border`, `--vl-color-border-strong`, `--vl-border-width` |
| Text | `--vl-color-text-primary`, `--vl-color-text-secondary`, `--vl-color-text-tertiary`, `--vl-color-text-on-accent`, `--vl-color-accent-text` |
| Semantic colors | `--vl-color-accent`, `--vl-color-success`, `--vl-color-warning`, `--vl-color-danger`, `--vl-color-info`, each with `-subtle` (a subtle background); `success`, `warning`, `danger` and `info` also with `-text` (readable as text). There are no separate hover and press colors: give clickable elements the [shared state layer](#clickable-custom-elements-data-vl-state) |
| Charts | `--vl-color-chart-1` … `--vl-color-chart-8` (with `-on` for text on them), `--vl-color-chart-muted`, `--vl-color-chart-grid`, `--vl-color-chart-axis` |
| Spacing | `--vl-space-0` … `--vl-space-8` (0, 4, 8, 12, 16, 24, 32, 48, 64 px) |
| Type | `--vl-font-size-2xs` … `--vl-font-size-4xl`, `--vl-font-weight-regular`, `-medium`, `-semibold`, `--vl-line-height-body`, `--vl-line-height-heading`, `--vl-font-family-body`, `-heading`, `-mono` |
| Radius | `--vl-radius-sm`, `-md`, `-lg`, `-xl`, `-2xl`, `-full` |
| Shadow | `--vl-shadow-near` (cards, none in dark mode), `--vl-shadow-thumb` (the selected item in a track, none in dark mode), `--vl-shadow-float` (menus), `--vl-shadow-pop` (dialogs) |
| Motion | `--vl-motion-ease-spring`, `--vl-motion-duration-spring` (appearing, moving, resizing), `-spring-bounce` (small indicators), `--vl-motion-duration-fast`, `-base`, `-slow`, `--vl-motion-duration-exit-fast`, `-exit`, `-exit-slow` (leaving), `--vl-motion-ease-standard`, `--vl-motion-ease-exit` |
| Focus | `--vl-color-focus-ring`, `--vl-color-focus-halo`, `--vl-focus-ring-width`, `--vl-focus-ring-offset`, `--vl-focus-halo-width` |
| Layers | `--vl-z-overlay`, `--vl-z-viewer`, `--vl-z-message` |

Token names follow theme fields: `bgSurface` becomes `--vl-color-bg-surface`. The primitive palette (`--vl-neutral-…`, `--vl-blue-…`) is also available, but semantic tokens adapt to the color mode while primitives remain fixed. Component tokens such as `--vl-control-height-md` follow the density.

In TypeScript, `cssVar('color-accent')` returns `'var(--vl-color-accent)'` for APIs that accept CSS color strings, such as SVG `fill` or third-party options. For canvas rendering and other APIs that cannot resolve CSS variables, use the resolved theme values in `useTheme().cssVars`.

## Clickable custom elements: `data-vl-state`

Add `data-vl-state` to custom interactive elements to apply the shared state layer. It overlays the content color on hover, darkens immediately on press without scaling, and displays a keyboard focus ring. The state layer is disabled for `disabled` and `aria-disabled="true"`; touch devices receive no hover layer.

```tsx
<button type="button" className={styles.entry} data-vl-state="" onClick={open}>
  …
</button>
```

- The state layer occupies `::before`; reserve that pseudo-element for the library.
- The element becomes `position: relative` and creates a stacking context; the layer inherits its `border-radius`.
- Use a native `<button>` or `<a>` for keyboard focus and activation.

## Entrance motion

To let an element fade in with a slight rise when it mounts, as Page does, give it a transition and its starting point with `@starting-style`. A transition starts from the current value, so it turns back smoothly if the element changes again halfway; a one-shot keyframe animation would jump (see [Entering and leaving with transitions](motion.md#entering-and-leaving-with-transitions) in the motion guide):

```css
.card {
  transition:
    opacity var(--vl-motion-duration-slow) var(--vl-motion-ease-standard),
    transform var(--vl-motion-duration-slow) var(--vl-motion-ease-standard);
}

@starting-style {
  .card {
    opacity: 0;
    transform: translateY(var(--vl-space-1));
  }
}
```

`@starting-style` applies only to a newly inserted element: the card rises in when it mounts, not when it rerenders. Reduced-motion preferences set the duration tokens to 0, and the card appears at once. The `vl-rise` keyframes of 1.x were removed in 2.0; replace `animation: global(vl-rise) …` with this transition.

## Page transitions

`vellum-ui/global.css` defines a transition for the element named `vl-main`: the previous page fades out, and the new page fades in with a slight rise. Navigation and surrounding content remain stationary.

1. AppShell already names its main area `vl-main`. For a custom shell, add `view-transition-name: vl-main;` to the page container.
2. Switch pages inside `document.startViewTransition` and render synchronously so the browser captures the new content:

```tsx
import { flushSync } from 'react-dom'

function navigate(next: PageKey) {
  if (!document.startViewTransition) return setPage(next)
  document.startViewTransition(() => flushSync(() => setPage(next)))
}
```

Browsers without View Transitions switch pages without animation. Reduced-motion preferences set the transition durations to 0.

## Behind images: the viewer tokens

Use viewer tokens for image and video surfaces, including canvases, viewers and thumbnail captions. Their neutral grays remain consistent across color modes and accent colors, preserving color perception.

| Token | Use |
| --- | --- |
| `--vl-viewer-bg-mid`, `--vl-viewer-bg-dark`, `--vl-viewer-bg-black` | The background behind the image (mid gray, dark gray, black) |
| `--vl-viewer-text`, `--vl-viewer-text-muted` | Text on that background |
| `--vl-viewer-control-bg`, `--vl-viewer-control-bg-hover`, `--vl-viewer-control-border` | Controls over the image |
| `--vl-viewer-placeholder` | The placeholder while an image loads |

`useTheme().viewerStage` provides the Lightbox background selection (`'mid'`, `'dark'` or `'black'`). Apply the same selection in custom viewers.

## Example

A home-page project card with a token-based surface, radius, state layer and entrance motion. For a whole page
with a style of its own, next to library components, see the [WorkspaceHome recipe](../recipes/WorkspaceHome.md).

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
  transition:
    opacity var(--vl-motion-duration-slow) var(--vl-motion-ease-standard),
    transform var(--vl-motion-duration-slow) var(--vl-motion-ease-standard);
}

@starting-style {
  .card {
    opacity: 0;
    transform: translateY(var(--vl-space-1));
  }
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

Text supplies typography and color; the CSS defines only the card-specific layout and appearance.
