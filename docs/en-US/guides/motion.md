**English** | [简体中文](../../zh-CN/guides/motion.md)

# Motion

Motion in the library aims to feel natural and responsive: elements appear from where they were triggered, move and settle along a spring, and can be interrupted at any time, turning back from where they are. This guide covers these principles, the motion of each component, the motion tokens, and how to keep the same feel in your own styles and themes.

## Principles

- **Things come from somewhere.** Popups grow out of the side of the element that opened them (the scale origin is on the edge next to it), dialogs grow out of the point that was clicked, and both shrink back when they close. It is clear what they belong to.
- **Motion can be interrupted.** Closing something halfway through opening sends it back from where it is, instead of jumping to fully open and then playing the closing animation. This is done with transitions rather than one-shot keyframe animations: a transition always starts from the current value.
- **Things move along a spring.** Elements that appear, move or change size follow a damped spring: they start crisply and settle softly. Small indicators (switch knobs, check marks) overshoot slightly and come back, which feels lively; elements that travel far (thumbs, panels, popups) do not overshoot, so they do not wobble.
- **Changes stay continuous.** The same thing changes between two states rather than being replaced: the selected background slides to the new item, an expanding panel grows continuously, and new tab content fades in as the old content fades out.
- **Feedback is immediate.** The state layer darkens the moment you press and recovers after release; pressing does not scale or move anything, and does not start an animation early.
- **Leaving is faster than entering.** Exits use the exit easing and a shorter duration so they do not get in the way of what comes next; a leaving element no longer takes clicks or focus.

## Motion of the components

| Component | Motion |
| --- | --- |
| Dropdown, Select, DatePicker, Cascader and other popups | Scale from the side of the trigger (0.95 → 1) and fade in along the spring; shrink and fade out when closing; can turn back halfway |
| Tooltip, Popover, Popconfirm | Grow from the side of the arrow (0.94 → 1); otherwise the same |
| Modal | Grows out of the point that was clicked while the mask fades in; shrinks and fades out when closing, then unmounts its content |
| Drawer | Slides in from the edge along the spring and leaves faster; opening it again while it closes turns it back from where it is |
| Lightbox | Fades in, and the image grows into place along the spring once loaded; switching images slides the new one in from the side you move toward; closing fades it out before unmounting |
| Switch | The knob lands on the other end along the bouncy spring (on the compositor thread, so it does not stall when the main thread is busy) |
| Checkbox, Radio | The check mark and the dot grow along the bouncy spring, without waiting for the box to change color |
| Segmented, Tabs | The selection thumb and underline slide along the spring; switching tabs fades the new content in with a slight rise |
| Nav | The selected background slides to the new current item along the spring; it follows at once when the sidebar collapses |
| Reasoning, ToolCalls, Sources, collapse panels, trees | Height changes along the spring when expanding and collapsing, with the chevron rotating along; Sources can turn back halfway |
| useMessage | Slides up from the bottom along the spring; the other messages glide to their new places |
| Page | The content fades in with a slight rise |

## Motion tokens

Durations and easings come from tokens, which themes can change, and the durations become zero with "reduce motion". See the [token reference](../tokens.md#motion) for all values.

| Token | Use |
| --- | --- |
| `--vl-motion-ease-spring`, `--vl-motion-duration-spring` | Appearing, moving, resizing: popups, panels, thumbs, expanding. No overshoot |
| `--vl-motion-ease-spring-bounce`, `--vl-motion-duration-spring-bounce` | Small indicators landing on a new state: switch knobs, check marks. Slight overshoot |
| `--vl-motion-ease-standard` | Changes that are not movement, such as color and opacity |
| `--vl-motion-ease-exit` | Exits |
| `--vl-motion-duration-fast`, `-base`, `-slow` | Hover (120 ms), color and opacity (200 ms), large panels (280 ms, can be combined with the spring easing) |

The spring easing is a CSS `linear()` easing and its duration is the time the spring takes to settle; use them as a pair. For large panels that should feel the same but move a little slower, combine the spring easing with `--vl-motion-duration-slow`.

## Using motion in your own styles

Motion in custom visuals (see [Custom styles](custom-styles.md)) also refers only to tokens and follows the principles above.

### Entering and leaving with transitions

Give the starting point of a newly mounted element with `@starting-style`, and switch to the leaving state with an attribute or class. Both directions are transitions, so they can turn back at any time:

```css
.panel {
  transition:
    opacity var(--vl-motion-duration-base) var(--vl-motion-ease-standard),
    transform var(--vl-motion-duration-spring) var(--vl-motion-ease-spring);
}

@starting-style {
  .panel {
    opacity: 0;
    transform: scale(0.96);
  }
}

.panel[data-leaving] {
  opacity: 0;
  transform: scale(0.98);
  pointer-events: none;
  transition-duration: var(--vl-motion-duration-fast);
  transition-timing-function: var(--vl-motion-ease-exit);
}
```

Unmount the element after it has left: listen for `transitionend` on the element itself, with a fallback timer based on the exit duration. With "reduce motion" the duration is zero, and a transition with zero duration does not fire `transitionend`; unmount at once in that case.

### Expanding and collapsing

Transition the height from zero to the height of the content with grid rows instead of `height: auto` (no measuring, supported by all browsers, and it can turn back halfway):

```css
.collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--vl-motion-duration-spring) var(--vl-motion-ease-spring);
}

.collapse[data-expanded] {
  grid-template-rows: 1fr;
}

.collapse > .clip {
  min-height: 0;
  overflow: hidden;
}
```

Hide collapsed content from screen readers and `Tab` with `visibility: hidden`, taking effect only after the collapsing transition has finished (see the implementation of Sources).

### Springs in scripts

For animations driven by scripts, such as with the Web Animations API, compile the spring to the same easing and duration with `springEasing`:

```ts
import { defaultSpring, springEasing } from 'vellum-ui'

const { easing, duration } = springEasing(defaultSpring)
element.animate([{ transform: 'translateY(8px)' }, { transform: 'none' }], { duration, easing })
```

Check "reduce motion" in scripts first (`matchMedia('(prefers-reduced-motion: reduce)')` and `data-vl-reduced-motion="true"` on the root element) and do not move anything when it is on.

## Tuning the springs in a theme

A spring has two parameters: `response`, the time of one swing without damping (milliseconds, smaller is faster), and `damping`, the damping ratio (1 does not overshoot, smaller values overshoot more). A theme only gives the parameters; `compileTheme` computes the easing and the duration:

```ts
import { defaultTheme, extendTheme } from 'vellum-ui'

const calmTheme = extendTheme(defaultTheme, {
  id: 'calm',
  scale: {
    // A slower spring without any overshoot
    motionSpring: { response: 320, damping: 1 },
    // Small indicators barely overshoot
    motionSpringBounce: { response: 300, damping: 0.85 },
  },
})
```

The defaults are `defaultSpring` (response 260 ms, damping 0.9, settling in about 240 ms) and `defaultSpringBounce` (response 280 ms, damping 0.72, overshooting by about 4 %).

## Reduced motion

The "reduce motion" setting of the operating system and the `reducedMotion` prop of ThemeProvider both set all motion durations to zero: popups, dialogs and drawers open and close at once, thumbs jump into place, and loading indicators do not spin. Transitions inside the components keep at least 1 ms, so that the animation state machine of antd still finishes; no animation is visible.

## Browser support

The spring easing uses the CSS `linear()` easing (Chrome 113, Safari 17.2, Firefox 112 and later). In older browsers the spring tokens fall back to similar Bézier curves: the motion is still there, without the settling of a spring. `@starting-style` is used for entering on mount; browsers without it show the element at once, which does not affect use. WebKitGTK 2.52 (Tauri on Linux) was tested and supports all of them.
