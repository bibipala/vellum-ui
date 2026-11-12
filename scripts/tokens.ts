/**
 * Design token reference: the CSS variables the theme compiles to, grouped into sections with a bilingual
 * description, and their values in the default theme (light and dark, comfortable and compact). Used by
 * scripts/docs.ts to write `docs/<language>/tokens.md`.
 *
 * Every compiled token must belong to a section; a new token without a section is reported as a problem, so the
 * reference cannot fall behind the theme.
 */
import type { DocText } from '../src/docs.ts'
import { compileTheme, resolveTheme } from '../src/theme/compile.ts'
import { defaultTheme } from '../src/themes/index.ts'

/** How the values of a section are shown: by color mode, by density, or one value. */
export type TokenColumns = 'mode' | 'density' | 'single'

export interface TokenSection {
  id: string
  title: DocText
  intro: DocText
  /** Tokens (without the `--vl-` prefix) of this section; the first matching section wins. */
  match: RegExp
  columns: TokenColumns
}

export const TOKEN_SECTIONS: readonly TokenSection[] = [
  {
    id: 'surfaces',
    title: { en: 'Surfaces, text and lines', zh: '表面、文字与线条' },
    intro: {
      en: 'Backgrounds from the page to overlays, neutral fills of controls (`color-fill-field` is the well of an input), dividers, the scrollbar thumb, and the three levels of text. Hierarchy comes from backgrounds, not from borders: `color-border` is only for dividers between rows.',
      zh: '从页面到浮层的背景、控件的中性填充（`color-fill-field` 是输入框的凹槽底色）、分隔线、滚动条滑块与三级文字。层次靠底色而不是描边：`color-border` 只用于行与行之间的分隔线。',
    },
    match: /^color-(bg|fill|border|text|scrollbar)-?/,
    columns: 'mode',
  },
  {
    id: 'accent',
    title: { en: 'Accent and status colors', zh: '强调色与状态色' },
    intro: {
      en: 'The single accent color and the status colors (`danger`, `warning`, `success`, `info`), each with derived states: `-hover`, `-active`, `-disabled`, `-subtle` (a light background, such as a selected row) and `-text` (the color as text or icon on the canvas, more readable than the base color). `color-accent-fill` is the solid accent of primary buttons and checked checkboxes.',
      zh: '唯一的强调色与状态色（`danger`、`warning`、`success`、`info`），各有派生状态：`-hover`、`-active`、`-disabled`、`-subtle`（浅底，如选中的行）与 `-text`（在画布上作为文字或图标时的颜色，比基础色更易读）。`color-accent-fill` 是主按钮、已勾选的复选框用的实心强调色。',
    },
    match: /^color-(accent|danger|warning|success|info)(-|$)/,
    columns: 'mode',
  },
  {
    id: 'focus',
    title: { en: 'Focus, states and shadow color', zh: '焦点、状态层与阴影色' },
    intro: {
      en: 'The keyboard focus ring and the halo of focused inputs; the state layer for hover and press is the content color at a fixed opacity (`state-*-opacity`), used through `data-vl-state` (see the custom styles guide).',
      zh: '键盘焦点环与输入框聚焦时的光环；悬停与按下的状态层是「内容色 + 固定透明度」（`state-*-opacity`），通过 `data-vl-state` 使用（见自定义样式指南）。',
    },
    match: /^(color-focus|color-shadow|state-)/,
    columns: 'mode',
  },
  {
    id: 'avatar',
    title: { en: 'Avatar colors', zh: '头像颜色' },
    intro: {
      en: 'Five tones for letter avatars (background and text); Avatar picks one from the name, so the same name always has the same color.',
      zh: '字母头像的五种色调（底色与文字色）；Avatar 按名称选取，同一个名字总是同一种颜色。',
    },
    match: /^color-avatar-/,
    columns: 'mode',
  },
  {
    id: 'chart',
    title: { en: 'Chart colors', zh: '图表颜色' },
    intro: {
      en: 'Categorical colors `color-chart-1` … `-8` in a fixed order (the n-th series always gets the n-th color) with the text color on each (`-on`); sequential `color-chart-seq-1` … `-7` for magnitudes; diverging `color-chart-div-1` … `-7` around a neutral middle; and muted, grid and axis colors. Status (good or bad) is never a chart color: use the status colors with an icon and text.',
      zh: '分类色 `color-chart-1` … `-8`，顺序固定（第 n 个系列总是第 n 个颜色），每个都有其上的文字色（`-on`）；顺序色 `color-chart-seq-1` … `-7` 表示大小；发散色 `color-chart-div-1` … `-7`，中间是中性色；另有弱化色、网格线与坐标轴的颜色。好坏状态不用图表颜色表示，用状态色并配图标与文字。',
    },
    match: /^color-chart-/,
    columns: 'mode',
  },
  {
    id: 'meter',
    title: { en: 'Meter colors', zh: '量表颜色' },
    intro: {
      en: 'Fill and track of Progress for each `tone`; the fill has a contrast of at least 3:1 to the track.',
      zh: 'Progress 各 `tone` 的填充与轨道颜色；填充与轨道的对比度至少 3:1。',
    },
    match: /^color-meter-/,
    columns: 'mode',
  },
  {
    id: 'typography',
    title: { en: 'Typography', zh: '文字排版' },
    intro: {
      en: 'Font families (Inter and JetBrains Mono, with CJK fallbacks), the font size steps, weights, line heights and letter spacing. In components, use `Text` and `Heading` instead of these tokens.',
      zh: '字体（Inter 与 JetBrains Mono，带中文回退字体）、字号档位、字重、行高与字距。在组件中用 `Text`、`Heading`，不直接用这些令牌。',
    },
    match: /^(font-|line-height-|letter-spacing-)/,
    columns: 'single',
  },
  {
    id: 'space',
    title: { en: 'Spacing', zh: '间距' },
    intro: {
      en: 'The spacing steps `0`–`8` that the `gap`, `padding` and similar props of the components take.',
      zh: '组件的 `gap`、`padding` 等属性所取的间距档位 `0`–`8`。',
    },
    match: /^space-/,
    columns: 'single',
  },
  {
    id: 'radius',
    title: { en: 'Corner radius', zh: '圆角' },
    intro: { en: 'Corner radius steps.', zh: '圆角档位。' },
    match: /^radius-/,
    columns: 'single',
  },
  {
    id: 'elevation',
    title: { en: 'Borders and shadows', zh: '描边与阴影' },
    intro: {
      en: 'The hairline width and the shadows: `shadow-near` for cards (none in dark mode), `shadow-thumb` for the selected item in a track such as Segmented (none in dark mode), `shadow-float` for menus and messages, `shadow-pop` for dialogs; `shadow-field` is the inner shadow that makes an input a well in the surface, and `shadow-raised` the hairline inner rim of light and faint diffuse shadow of solid buttons. In dark mode overlays get a translucent outline instead of a heavier shadow.',
      zh: '发丝线宽度与各档阴影：`shadow-near` 用于卡片（深色模式下没有），`shadow-thumb` 用于轨道中的选中项，如 Segmented（深色模式下没有），`shadow-float` 用于菜单与消息条，`shadow-pop` 用于对话框；`shadow-field` 是输入框的内阴影（表面上的凹槽），`shadow-raised` 是实色按钮的一圈极细内缘光与很淡的发散阴影。深色模式下浮层用半透明轮廓代替更重的阴影。',
    },
    match: /^(border-width|shadow-)/,
    columns: 'mode',
  },
  {
    id: 'motion',
    title: { en: 'Motion', zh: '动效' },
    intro: {
      en: 'Durations (hover 120 ms, selection indicators and dialogs 200 ms, drawers and pages 280 ms), easing curves, and the 200 ms delay before loading indicators appear. With "reduce motion" the durations become 0; the loading delay stays.',
      zh: '时长（悬停 120ms、选中指示与对话框 200ms、抽屉与页面 280ms）、缓动曲线，以及加载指示出现前的 200ms 延迟。「减少动态效果」打开时时长变为 0，加载延迟保留。',
    },
    match: /^motion-/,
    columns: 'single',
  },
  {
    id: 'layers',
    title: { en: 'Layers', zh: '层级' },
    intro: {
      en: 'Stacking order: overlays, then the image viewer, then messages above everything.',
      zh: '叠放顺序：浮层，其上是看图，消息条在最上面。',
    },
    match: /^z-/,
    columns: 'single',
  },
  {
    id: 'viewer',
    title: { en: 'Viewer background', zh: '看图背景' },
    intro: {
      en: 'The neutral, chroma-free background of Lightbox and of image captions in ImageGrid. It does not follow the accent color or the color mode, because a tinted background changes how the colors in images are perceived.',
      zh: 'Lightbox 与 ImageGrid 图片说明的中性无彩背景。它不随强调色与明暗模式变化，因为带色调的背景会改变人对图片颜色的感知。',
    },
    match: /^viewer-/,
    columns: 'single',
  },
  {
    id: 'titlebar',
    title: { en: 'Window title bar area', zh: '窗口标题栏区域' },
    intro: {
      en: "The part of the window that the system window controls cover when a desktop client (Electron, Tauri) or an installed web app draws its own title bar and lets the page extend to the top of the window: `titlebar-height` is its height, `titlebar-inset-left` / `titlebar-inset-right` are the widths taken by the window controls on each side (physical sides: the controls are on the right on Windows and Linux and on the left on macOS, whatever the writing direction). By default they come from the standard `env(titlebar-area-*)` variables of Window Controls Overlay and are all 0 in an ordinary browser tab. A desktop shell that does not provide those variables sets the three tokens on the root element, for example `document.documentElement.style.setProperty('--vl-titlebar-height', '44px')`. Drawer and Lightbox then open below the title bar, and the header of a full-window AppShell leaves room for the window controls. Overlays and popups are marked `app-region: no-drag`, so a draggable title bar underneath them does not take their clicks.",
      zh: "桌面客户端（Electron、Tauri）或安装的网页应用自绘标题栏、让页面延伸到窗口顶部时，系统窗口按钮覆盖的那部分窗口：`titlebar-height` 是它的高度，`titlebar-inset-left` / `titlebar-inset-right` 是两侧窗口按钮占去的宽度（物理方向：Windows 与 Linux 上按钮在右侧，macOS 上在左侧，与书写方向无关）。默认取标准的 Window Controls Overlay 环境变量 `env(titlebar-area-*)`，在普通浏览器标签页中都是 0。不提供这些环境变量的桌面外壳在根元素上写入这三个令牌，如 `document.documentElement.style.setProperty('--vl-titlebar-height', '44px')`。之后 Drawer 与 Lightbox 在标题栏之下打开，占满窗口的 AppShell 的顶栏为窗口按钮留出位置。浮层与弹出层标记为 `app-region: no-drag`，下面可拖动的标题栏不会抢走它们的点击。",
    },
    match: /^titlebar-/,
    columns: 'single',
  },
  {
    id: 'primitive',
    title: { en: 'Primitive palette', zh: '原始色板' },
    intro: {
      en: 'The raw palette the semantic colors are built from. Do not use these in application CSS: they do not change with the color mode. Use the semantic colors above.',
      zh: '构成语义颜色的原始色板。应用的 CSS 中不要使用：它们不随明暗模式变化。请用上面的语义颜色。',
    },
    match: /^(neutral|blue|status)-/,
    columns: 'single',
  },
  {
    id: 'component',
    title: { en: 'Component sizes', zh: '组件尺寸' },
    intro: {
      en: 'Sizes that the components use, many of them depending on the density (comfortable or compact). Applications rarely need them; they are listed so that custom elements can line up with the components, such as `control-height-md`.',
      zh: '组件使用的尺寸，其中很多随密度（舒适或紧凑）变化。应用很少需要；列在这里是为了让自定义元素能与组件对齐，如 `control-height-md`。',
    },
    // 颜色令牌必须归入上面的某一节，不能落到这里
    match: /^(?!color-)/,
    columns: 'density',
  },
]

export interface TokenRow {
  name: string
  light: string
  dark: string
  compact: string
}

/** The compiled tokens of the default theme, without the `--vl-` prefix, by section; `unmatched` must be empty. */
export function tokenRows(): {
  sections: { section: TokenSection; rows: TokenRow[] }[]
  unmatched: string[]
} {
  const strip = (vars: Readonly<Record<string, string>>) =>
    Object.fromEntries(Object.entries(vars).map(([k, v]) => [k.replace(/^--vl-/, ''), v]))
  const light = strip(compileTheme(resolveTheme(defaultTheme, 'light')))
  const dark = strip(compileTheme(resolveTheme(defaultTheme, 'dark')))
  const compact = strip(compileTheme(resolveTheme(defaultTheme, 'light'), { density: 'compact' }))
  const sections = TOKEN_SECTIONS.map((section) => ({ section, rows: [] as TokenRow[] }))
  const unmatched: string[] = []
  for (const name of Object.keys(light)) {
    const target = sections.find((s) => s.section.match.test(name))
    if (!target) unmatched.push(name)
    target?.rows.push({
      name,
      light: light[name] ?? '',
      dark: dark[name] ?? '',
      compact: compact[name] ?? '',
    })
  }
  return { sections: sections.filter((s) => s.rows.length), unmatched }
}
