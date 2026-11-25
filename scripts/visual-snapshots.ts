/**
 * 视觉回归快照：给已构建的文档站（site/dist）的一组固定页面截图，并比较两次截图，证明一次改动没有可见的变化。
 * 本脚本不构建任何东西，先运行 `pnpm site:build`。浏览器用系统的 Chromium（CHROMIUM_PATH，默认 /usr/bin/chromium）。
 *
 *   pnpm site:build && pnpm visual:shoot /tmp/vellum-visual/before
 *   （改动后）pnpm site:build && pnpm visual:shoot /tmp/vellum-visual/after
 *   pnpm visual:diff /tmp/vellum-visual/before /tmp/vellum-visual/after
 *
 * shoot <outDir> [--site <dir>] [--only <子串>]
 *   每张截图（<名字>.png）旁边另存一份计算样式（<名字>.styles.txt.gz）：页面上每个元素（含 ::before、::after）的
 *   一组计算样式，按 DOM 路径记录。截图在「减少动态效果」下拍（动画都在终点，结果确定）；计算样式在恢复正常动效后
 *   读取，过渡的时长与曲线也在比较之内，截图看不出的动效变化也能发现。浅色的页面与弹层另做一次状态扫描
 *   （<名字>.states.txt.gz）：逐个强制可交互元素的悬停、键盘焦点与按下，记录附近元素的样式变化，焦点环、悬停色这类
 *   截图拍不到的状态也在比较之内。默认输出到系统临时目录下的 vellum-visual/latest。
 * diff <dirA> <dirB> [--threshold <百分比>] [--tolerance <0–255>] [--out <dir>]
 *   在 Chromium 里把两张 PNG 画到画布上，逐像素比较 getImageData 的结果：任一通道相差超过 tolerance 的像素算变化，
 *   变化的像素不超过 threshold（占全图的百分比）算相同。有变化的图片输出一张差异图（变化处标红），计算样式与状态扫描的
 *   差异写成文本。默认输出到 <dirB> 旁的 diff-<A>-<B>。有不同的图片时退出码为 1。
 *
 * 机器内存紧张时不要与其他浏览器测试同时运行；在只有回环网卡的网络命名空间里运行（见 dev/lessons.md）：
 *   unshare -rn sh -c 'ip link set lo up && pnpm visual:shoot /tmp/vellum-visual/before'
 */
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { type Browser, chromium, type Page } from 'playwright-core'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))
const chromiumPath =
  process.env.CHROMIUM_PATH || (process.platform === 'linux' ? '/usr/bin/chromium' : undefined)

/** 视口宽度与普通截图的高度；整页截图把视口拉高到内容的高度（最多 MAX_HEIGHT），站点的外框随窗口变高。 */
const VIEWPORT = { width: 1280, height: 800 }
const MAX_HEIGHT = 12000
/** 页面里的「今天」固定为这一刻（时间照常流逝），日期面板等不随拍摄的日期变化。 */
const FIXED_NOW = '2026-06-15T09:30:00'
/**
 * 默认的比较阈值：通道差超过 TOLERANCE 的像素算变化；变化的像素不超过 THRESHOLD（%）算相同。同一构建连拍两次逐像素
 * 相同（2026-11-25，138 张，容差 0）。阈值只留给抗锯齿的微小差异：样式注入的时机变了，Chromium 可能多保留或少保留
 * 一个合成层（如进场动画结束后的页面），层里文字与圆角的抗锯齿差几个像素，而所有元素的位置与计算样式都相同。
 * 1280×800 的截图约 10 个像素。
 */
const TOLERANCE = 2
const THRESHOLD = 0.001

// —— 拍摄清单 ——

type Mode = 'light' | 'dark'
type Density = 'comfortable' | 'compact'

/** 拍摄前的交互：在某个示例（data-testid="example-<名字>"）里点击、悬停或用键盘聚焦第一个匹配的元素。 */
interface Action {
  readonly kind: 'click' | 'hover' | 'focus'
  readonly example: string
  readonly target: string
  /** 交互后等待出现的元素（弹层）；聚焦时检查目标确实是 :focus-visible。 */
  readonly waitFor?: string
}

/**
 * 状态扫描的范围：整个页面、主内容区与弹层、只有弹层。扫描逐个强制可交互元素的 :hover、键盘焦点与按下，记录附近元素
 * 计算样式的变化（只在浅色下扫描：深色的规则与浅色相同，只是令牌的值不同）。
 */
type SweepScope = 'all' | 'main' | 'portals'

interface Shot {
  readonly name: string
  readonly hash: string
  readonly mode: Mode
  readonly density: Density
  readonly action?: Action
  readonly sweep?: SweepScope
}

const COMPONENTS = [
  'Button',
  'IconButton',
  'Input',
  'InputNumber',
  'AutoComplete',
  'Select',
  'TreeSelect',
  'Cascader',
  'DatePicker',
  'TimePicker',
  'ColorPicker',
  'Form',
  'Checkbox',
  'Radio',
  'Switch',
  'Segmented',
  'Slider',
  'Tabs',
  'Steps',
  'Pagination',
  'Breadcrumb',
  'Tree',
  'Descriptions',
  'Timeline',
  'Alert',
  'Panel',
  'Section',
  'DataTable',
  'InlineEdit',
  'Nav',
  'AppShell',
  'Modal',
  'Drawer',
  'Dropdown',
  'Popover',
  'Popconfirm',
  'Tooltip',
  'Upload',
  'FilePreview',
  'LineChart',
  'Markdown',
  'MessageList',
  'PromptInput',
  'Reasoning',
  'ToolCalls',
] as const
const RECIPES = ['Dashboard', 'SettingsPage', 'ListPage', 'ChatPage'] as const
/** 另在紧凑密度下拍一次的页面（浅色）。 */
const COMPACT = ['Button', 'Input', 'Select', 'Form', 'Radio', 'DataTable'] as const

const click = (target: string, waitFor: string): Action => ({
  kind: 'click',
  example: 'Basic',
  target,
  waitFor,
})
const hover = (target: string, waitFor: string): Action => ({
  kind: 'hover',
  example: 'Basic',
  target,
  waitFor,
})

/** 打开弹层（浅色、深色各一张）：点击或悬停第一个示例的触发元素。 */
const OVERLAYS: Record<string, Action> = {
  Modal: click('button', '.ant-modal-wrap .ant-modal'),
  Drawer: click('button', '.ant-drawer-open'),
  Dropdown: click('button', '.ant-dropdown:not(.ant-dropdown-hidden)'),
  Select: click('.ant-select', '.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
  TreeSelect: click('.ant-select', '.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
  Cascader: click('.ant-select', '.ant-select-dropdown:not(.ant-select-dropdown-hidden)'),
  DatePicker: click('.ant-picker', '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'),
  TimePicker: click('.ant-picker', '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)'),
  Popconfirm: click('button', '.ant-popover:not(.ant-popover-hidden)'),
  Popover: hover('button, a', '.ant-popover:not(.ant-popover-hidden)'),
  Tooltip: hover('button', '.ant-tooltip:not(.ant-tooltip-hidden)'),
}

/** 键盘焦点环（浅色）：用键盘聚焦第一个示例里的第一个可聚焦元素。 */
const FOCUS: Record<string, string> = {
  Button: 'button',
  Input: 'input',
  Select: 'input',
  Checkbox: 'input',
  Radio: 'input',
  Switch: '[role="switch"]',
  Segmented: 'input',
  Tabs: '[role="tab"]',
  Slider: '[role="slider"]',
  Pagination: '[tabindex="0"]',
}

function shots(): Shot[] {
  const list: Shot[] = []
  const add = (
    name: string,
    path: string,
    mode: Mode,
    density: Density,
    action?: Action,
    sweep?: SweepScope,
  ) => list.push({ name, hash: `#/en${path ? `/${path}` : ''}`, mode, density, action, sweep })
  for (const mode of ['light', 'dark'] as const) {
    const sweep = (scope: SweepScope) => (mode === 'light' ? scope : undefined)
    add(`overview-${mode}`, '', mode, 'comfortable', undefined, sweep('all'))
    for (const c of COMPONENTS)
      add(
        `component-${c}-${mode}`,
        `components/${c}`,
        mode,
        'comfortable',
        undefined,
        sweep('main'),
      )
    for (const r of RECIPES)
      add(`recipe-${r}-${mode}`, `recipes/${r}`, mode, 'comfortable', undefined, sweep('main'))
    for (const [c, action] of Object.entries(OVERLAYS))
      add(
        `component-${c}-open-${mode}`,
        `components/${c}`,
        mode,
        'comfortable',
        action,
        sweep('portals'),
      )
  }
  for (const c of COMPACT)
    add(`component-${c}-compact-light`, `components/${c}`, 'light', 'compact')
  for (const [c, target] of Object.entries(FOCUS))
    add(`component-${c}-focus-light`, `components/${c}`, 'light', 'comfortable', {
      kind: 'focus',
      example: 'Basic',
      target,
    })
  return list
}

// —— 参数 ——

function parseArgs(argv: readonly string[]) {
  const positional: string[] = []
  const options = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=', 2) as [string, string | undefined]
      const value = inline ?? argv[i + 1]
      if (value === undefined) throw new Error(`缺少 --${key} 的值`)
      if (inline === undefined) i++
      options.set(key, value)
    } else positional.push(arg)
  }
  return { positional, options }
}

function numberOption(options: Map<string, string>, key: string, fallback: number): number {
  const raw = options.get(key)
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0) throw new Error(`--${key} 必须是非负数：${raw}`)
  return value
}

async function launch(): Promise<Browser> {
  return chromium.launch({ executablePath: chromiumPath })
}

// —— 静态服务 ——

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

async function serve(root: string) {
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    const file = normalize(join(root, urlPath === '/' ? 'index.html' : urlPath))
    // 根目录约束：不允许 .. 逃逸出站点目录
    if (!file.startsWith(root + sep) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}/index.html`, close: () => server.close() }
}

// —— 页面里运行的函数（序列化后传入页面，只能用自身的变量） ——

/** 固定「今天」与 Math.random：每次加载页面的日期与随机数相同。 */
function pageInit(args: { now: string; mode: Mode; density: Density }) {
  const RealDate = Date
  const offset = new RealDate(args.now).getTime() - RealDate.now()
  class FixedDate extends RealDate {
    constructor(...params: ConstructorParameters<DateConstructor> | []) {
      if (params.length === 0) super(RealDate.now() + offset)
      else super(...(params as ConstructorParameters<DateConstructor>))
    }
    static override now() {
      return RealDate.now() + offset
    }
  }
  globalThis.Date = FixedDate as DateConstructor
  // mulberry32：确定的伪随机序列
  let seed = 0x5eed
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  // about:blank 上读写 localStorage 会报 SecurityError
  try {
    localStorage.setItem('vellum-ui-docs:color-mode', args.mode)
    localStorage.setItem('vellum-ui-docs:density', args.density)
    localStorage.setItem('vellum-ui-docs:lang', 'en')
  } catch {}
}

/** DOM 在 quietMs 内没有变化（或超过 maxMs）时完成。 */
function domQuiet(args: { quietMs: number; maxMs: number }) {
  return new Promise<boolean>((done) => {
    let timer = setTimeout(finish, args.quietMs)
    const limit = setTimeout(() => finish(false), args.maxMs)
    const observer = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(finish, args.quietMs)
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    })
    function finish(quiet = true) {
      observer.disconnect()
      clearTimeout(timer)
      clearTimeout(limit)
      done(quiet)
    }
  })
}

/** 正在进行的过渡与动画：有限的跳到终点，无限循环的停在起点。 */
function settleAnimations() {
  for (const animation of document.getAnimations()) {
    const timing = animation.effect?.getComputedTiming()
    if (
      timing?.iterations === Number.POSITIVE_INFINITY ||
      timing?.endTime === Number.POSITIVE_INFINITY
    ) {
      animation.pause()
      animation.currentTime = 0
    } else animation.finish()
  }
}

/** 主滚动区域还需要多高才能完整显示（像素）。 */
function overflowHeight() {
  let extra = 0
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    const style = getComputedStyle(el)
    if (!/(auto|scroll)/.test(style.overflowY)) continue
    extra = Math.max(extra, el.scrollHeight - el.clientHeight)
  }
  return Math.max(extra, document.documentElement.scrollHeight - innerHeight)
}

/** 逐个元素（含 ::before、::after）记录一组计算样式，每行「DOM 路径 \t 属性:值 …」；跳过 SVG 与画布的内部。 */
function dumpStyles(props: readonly string[]) {
  const lines: string[] = []
  const record = (path: string, style: CSSStyleDeclaration) =>
    `${path}\t${props.map((p) => `${p}:${style.getPropertyValue(p)}`).join('\t')}`
  const walk = (el: Element, path: string) => {
    const tag = el.tagName.toLowerCase()
    if (tag === 'script' || tag === 'style' || tag === 'link' || tag === 'template') return
    lines.push(record(path, getComputedStyle(el)))
    for (const pseudo of ['::before', '::after']) {
      const style = getComputedStyle(el, pseudo)
      const content = style.getPropertyValue('content')
      if (content !== 'none' && content !== 'normal') lines.push(record(`${path}${pseudo}`, style))
    }
    if (tag === 'svg' || tag === 'canvas') return
    let i = 0
    for (const child of el.children) walk(child, `${path}>${child.tagName.toLowerCase()}:${i++}`)
  }
  walk(document.body, 'body')
  return lines.join('\n')
}

/** 状态扫描用的页面辅助：给范围内的可交互元素标上 data-vl-sweep 序号，记录强制伪类前后附近元素的样式差异。 */
function installSweep(args: {
  readonly props: readonly string[]
  readonly selector: string
  readonly scope: SweepScope
  readonly limit: number
}) {
  const pathOf = (el: Element): string => {
    const parts: string[] = []
    let node: Element = el
    while (node !== document.body && node.parentElement) {
      const parent: Element = node.parentElement
      parts.unshift(
        `${node.tagName.toLowerCase()}:${Array.prototype.indexOf.call(parent.children, node)}`,
      )
      node = parent
    }
    return ['body', ...parts].join('>')
  }
  const root = document.getElementById('root')
  const inScope = (el: Element) => {
    if (el.closest('svg')) return false
    if (args.scope === 'all') return true
    const portal = !root?.contains(el)
    return args.scope === 'portals' ? portal : portal || el.closest('main') !== null
  }
  const targets = [...document.querySelectorAll(args.selector)].filter(inScope).slice(0, args.limit)
  targets.forEach((el, i) => {
    el.setAttribute('data-vl-sweep', String(i))
  })
  // 附近：上面两层、元素本身、里面最多 20 个元素，各自的 ::before、::after
  const read = (el: Element) => {
    const nodes: Element[] = []
    for (
      let up = el.parentElement, i = 0;
      up && up !== document.body && i < 2;
      up = up.parentElement, i++
    )
      nodes.push(up)
    nodes.push(el)
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT)
    for (let n = 0; n < 20 && walker.nextNode(); n++) nodes.push(walker.currentNode as Element)
    const out = new Map<string, string[]>()
    for (const node of nodes) {
      const path = pathOf(node)
      for (const pseudo of ['', '::before', '::after']) {
        const style = getComputedStyle(node, pseudo || null)
        const content = style.getPropertyValue('content')
        if (pseudo && (content === 'none' || content === 'normal')) continue
        out.set(
          path + pseudo,
          args.props.map((p) => style.getPropertyValue(p)),
        )
      }
    }
    return out
  }
  const settle = () => {
    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getComputedTiming()
      if (
        timing?.iterations === Number.POSITIVE_INFINITY ||
        timing?.endTime === Number.POSITIVE_INFINITY
      ) {
        animation.pause()
        animation.currentTime = 0
      } else animation.finish()
    }
  }
  let base = new Map<string, string[]>()
  const sweep = {
    base(i: number) {
      const el = targets[i] as Element
      getComputedStyle(el).color
      settle()
      base = read(el)
    },
    delta(i: number, state: string) {
      const el = targets[i] as Element
      // 先算一次样式（强制的伪类生效、过渡开始），再把过渡跳到终点
      getComputedStyle(el).color
      settle()
      const now = read(el)
      const lines: string[] = []
      const target = pathOf(el)
      for (const key of new Set([...base.keys(), ...now.keys()])) {
        const before = base.get(key)
        const after = now.get(key)
        const changes = args.props.flatMap((p, k) =>
          before?.[k] === after?.[k] ? [] : [`${p}:${before?.[k] ?? '∅'}→${after?.[k] ?? '∅'}`],
        )
        if (changes.length) lines.push(`${state}\t${target}\t${key}\t${changes.join('\t')}`)
      }
      return lines
    },
  }
  ;(globalThis as unknown as { __vlSweep: typeof sweep }).__vlSweep = sweep
  // 禁用的控件拿不到焦点：不扫描它们的键盘焦点
  const disabled = targets.flatMap((el, i) => (el.matches(':disabled') ? [i] : []))
  return { count: targets.length, disabled }
}

/** 状态扫描的元素：链接、按钮、表单控件、有角色或 tabindex 的元素、状态层，以及 antd 里悬停时变化的外框。 */
const SWEEP_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'textarea',
  'label',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="treeitem"]',
  '[role="combobox"]',
  '[tabindex]',
  '[data-vl-state]',
  '.ant-select',
  '.ant-picker',
  '.ant-input-affix-wrapper',
  '.ant-input-number',
  '.ant-color-picker-trigger',
  '.ant-pagination-item',
  '.ant-segmented-item',
  '.ant-tree-node-content-wrapper',
  '.ant-picker-cell',
  '.ant-select-item',
  '.ant-cascader-menu-item',
  '.ant-dropdown-menu-item',
  '.ant-upload',
  '.ant-tabs-tab',
  '.ant-steps-item',
  '.ant-slider',
].join(', ')
/** 每张截图最多扫描的元素数。 */
const SWEEP_LIMIT = 300
/** 强制的伪类：悬停、键盘焦点（禁用的控件除外）、按下（按下时也悬停）。 */
const SWEEP_STATES: readonly (readonly [string, string[]])[] = [
  ['hover', ['hover']],
  ['focus', ['focus', 'focus-visible']],
  ['active', ['hover', 'active']],
]
/** 状态扫描比较的属性：状态变化会改的那些。 */
const SWEEP_PROPS = [
  'display',
  'visibility',
  'opacity',
  'color',
  'background-color',
  'background-image',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-width',
  'border-bottom-width',
  'outline-style',
  'outline-width',
  'outline-color',
  'outline-offset',
  'box-shadow',
  'transform',
  'translate',
  'scale',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'z-index',
  'text-decoration-line',
  'font-weight',
  'cursor',
  'filter',
  'transition-property',
  'transition-duration',
] as const

/** 计算样式中比较的属性：布局、盒子、颜色、阴影、变换、过渡与动画、文字。 */
const STYLE_PROPS = [
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'z-index',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'box-sizing',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'outline-style',
  'outline-width',
  'outline-color',
  'outline-offset',
  'background-color',
  'background-image',
  'background-clip',
  'color',
  'opacity',
  'visibility',
  'box-shadow',
  'transform',
  'translate',
  'scale',
  'rotate',
  'transform-origin',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-iteration-count',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'font-variant-numeric',
  'text-align',
  'text-decoration-line',
  'white-space',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'align-items',
  'justify-content',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'overflow-x',
  'overflow-y',
  'pointer-events',
  'cursor',
  'isolation',
  'filter',
  'backdrop-filter',
  'clip-path',
  'content',
] as const

// —— 拍摄 ——

async function waitForPage(page: Page, shot: Shot) {
  await page.waitForFunction(
    (s) =>
      document.documentElement.dataset.vlMode === s.mode &&
      document.documentElement.dataset.vlDensity === s.density &&
      document.querySelector('main h1') !== null,
    { mode: shot.mode, density: shot.density },
    { timeout: 20000 },
  )
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.evaluate(domQuiet, { quietMs: 400, maxMs: 6000 })
}

async function act(page: Page, action: Action) {
  const example = page.locator(`[data-testid="example-${action.example}"]`).first()
  const target = example.locator(action.target).first()
  await target.scrollIntoViewIfNeeded()
  if (action.kind === 'click') await target.click()
  else if (action.kind === 'hover') await target.hover()
  else {
    // 先按一次键，焦点来自键盘（:focus-visible），再用脚本聚焦目标
    await page.keyboard.press('Shift')
    await target.focus()
    const visible = await target.evaluate((el) => el.matches(':focus-visible'))
    if (!visible) throw new Error(`${action.target} 没有 :focus-visible`)
  }
  if (action.waitFor) await page.locator(action.waitFor).first().waitFor({ state: 'visible' })
  await page.evaluate(domQuiet, { quietMs: 400, maxMs: 4000 })
}

interface SweepApi {
  base(i: number): void
  delta(i: number, state: string): string[]
}

/**
 * 状态扫描：用 DevTools 协议的 CSS.forcePseudoState 逐个强制伪类（不触发事件，弹层不会打开），收集附近元素的计算样式
 * 变化，每行「状态 \t 元素 \t 受影响的元素 \t 属性:之前→之后 …」。
 */
async function sweepStates(page: Page, scope: SweepScope): Promise<string> {
  const { count, disabled } = await page.evaluate(installSweep, {
    props: SWEEP_PROPS,
    selector: SWEEP_SELECTOR,
    scope,
    limit: SWEEP_LIMIT,
  })
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', {
      nodeId: root.nodeId,
      selector: '[data-vl-sweep]',
    })
    if (nodeIds.length !== count)
      throw new Error(`状态扫描：页面标记了 ${count} 个元素，协议找到 ${nodeIds.length} 个`)
    const lines: string[] = []
    // 协议按文档顺序返回，与页面里的序号一致
    for (const [i, nodeId] of nodeIds.entries()) {
      await page.evaluate(
        (k) => (globalThis as unknown as { __vlSweep: SweepApi }).__vlSweep.base(k),
        i,
      )
      for (const [state, forced] of SWEEP_STATES) {
        if (state === 'focus' && disabled.includes(i)) continue
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced })
        lines.push(
          ...(await page.evaluate(
            ([k, s]) => (globalThis as unknown as { __vlSweep: SweepApi }).__vlSweep.delta(k, s),
            [i, state] as const,
          )),
        )
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
      }
    }
    return lines.join('\n')
  } finally {
    await cdp.detach()
  }
}

async function shoot(outDir: string, siteDir: string, only: string | undefined) {
  if (!existsSync(join(siteDir, 'index.html')))
    throw new Error(`${siteDir} 中没有 index.html，请先运行 pnpm site:build`)
  mkdirSync(outDir, { recursive: true })
  const list = shots().filter((s) => !only || s.name.includes(only))
  const server = await serve(siteDir)
  const browser = await launch()
  const manifest: { name: string; hash: string; width: number; height: number }[] = []
  try {
    for (const shot of list) {
      const context = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        reducedMotion: 'reduce',
        locale: 'en-US',
        timezoneId: 'UTC',
      })
      try {
        await context.addInitScript(pageInit, {
          now: FIXED_NOW,
          mode: shot.mode,
          density: shot.density,
        })
        const page = await context.newPage()
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.goto(`${server.url}${shot.hash}`, { waitUntil: 'load' })
        await waitForPage(page, shot)
        // 整页：视口拉高到内容的高度；弹层与焦点：普通视口
        if (!shot.action) {
          const extra = await page.evaluate(overflowHeight)
          const height = Math.min(VIEWPORT.height + extra, MAX_HEIGHT)
          if (height !== VIEWPORT.height) {
            await page.setViewportSize({ width: VIEWPORT.width, height })
            await page.evaluate(domQuiet, { quietMs: 400, maxMs: 4000 })
          }
        } else await act(page, shot.action)
        await page.evaluate(settleAnimations)
        const png = join(outDir, `${shot.name}.png`)
        await page.screenshot({ path: png, animations: 'disabled', caret: 'hide' })
        // 恢复正常动效再读计算样式：过渡的时长也在比较之内
        await page.emulateMedia({ reducedMotion: 'no-preference' })
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        )
        // 循环动画（加载图标的旋转）随动效恢复重新开始，停在起点，读到的变换与时间无关
        await page.evaluate(settleAnimations)
        const styles = await page.evaluate(dumpStyles, STYLE_PROPS)
        writeFileSync(join(outDir, `${shot.name}.styles.txt.gz`), gzipSync(styles))
        if (shot.sweep) {
          const states = await sweepStates(page, shot.sweep)
          writeFileSync(join(outDir, `${shot.name}.states.txt.gz`), gzipSync(states))
        }
        const size = page.viewportSize() ?? VIEWPORT
        manifest.push({ name: shot.name, hash: shot.hash, ...size })
        if (errors.length) console.warn(`  ${shot.name}: 页面错误 ${errors.join('; ')}`)
        console.log(`${shot.name}  ${size.width}×${size.height}`)
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
    server.close()
  }
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`\n${list.length} 张截图已保存到 ${outDir}`)
}

// —— 比较 ——

interface PixelResult {
  readonly width: number
  readonly height: number
  readonly sameSize: boolean
  readonly changed: number
  readonly diff: string | null
}

/** 在页面里解码两张 PNG、逐像素比较，有变化时返回差异图（PNG 的 base64）。 */
async function comparePixels(args: {
  a: string
  b: string
  tolerance: number
}): Promise<PixelResult> {
  const decode = async (b64: string) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
    return createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  }
  const [a, b] = await Promise.all([decode(args.a), decode(args.b)])
  const width = Math.max(a.width, b.width)
  const height = Math.max(a.height, b.height)
  const pixels = (bitmap: ImageBitmap) => {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, width, height, { colorSpace: 'srgb' }).data
  }
  const pa = pixels(a)
  const pb = pixels(b)
  const out = new Uint8ClampedArray(pa.length)
  let changed = 0
  for (let i = 0; i < pa.length; i += 4) {
    const delta = Math.max(
      Math.abs((pa[i] as number) - (pb[i] as number)),
      Math.abs((pa[i + 1] as number) - (pb[i + 1] as number)),
      Math.abs((pa[i + 2] as number) - (pb[i + 2] as number)),
      Math.abs((pa[i + 3] as number) - (pb[i + 3] as number)),
    )
    if (delta > args.tolerance) {
      changed++
      out[i] = 255
      out[i + 1] = 0
      out[i + 2] = 80
    } else {
      // 没变的像素：A 的灰度，压淡到浅灰，差异处一眼可见
      const gray =
        0.299 * (pa[i] as number) + 0.587 * (pa[i + 1] as number) + 0.114 * (pa[i + 2] as number)
      const v = 200 + gray * 0.2
      out[i] = v
      out[i + 1] = v
      out[i + 2] = v
    }
    out[i + 3] = 255
  }
  const sameSize = a.width === b.width && a.height === b.height
  if (changed === 0 && sameSize) return { width, height, sameSize, changed, diff: null }
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  ctx.putImageData(new ImageData(out, width, height), 0, 0)
  const bytes = new Uint8Array(
    await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer(),
  )
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { width, height, sameSize, changed, diff: btoa(binary) }
}

/**
 * CSS Modules 生成的名字（如关键帧 `_search-spin_wr0kl_1`）带模块内容的哈希，模块文件一改就变：比较时去掉哈希与行号。
 */
const unhash = (text: string) => text.replace(/\b_([A-Za-z][\w-]*?)_[a-z0-9]{5}_\d+\b/g, '_$1')

/** 读出一份压缩的文本（计算样式或状态扫描），去掉 CSS Modules 名字里的哈希。 */
const readText = (file: string) => unhash(gunzipSync(readFileSync(file)).toString('utf8'))

/** 两份计算样式的差异：按 DOM 路径对齐，列出不同的属性。 */
function compareStyles(fileA: string, fileB: string) {
  const parse = (file: string) => {
    const map = new Map<string, string[]>()
    for (const line of readText(file).split('\n')) {
      const [path, ...props] = line.split('\t')
      if (path) map.set(path, props)
    }
    return map
  }
  const a = parse(fileA)
  const b = parse(fileB)
  const report: string[] = []
  let elements = 0
  for (const [path, propsA] of a) {
    const propsB = b.get(path)
    if (!propsB) {
      elements++
      report.push(`- ${path}（只在 A 中）`)
      continue
    }
    const changes = propsA.filter((p, i) => p !== propsB[i])
    if (!changes.length) continue
    elements++
    report.push(path)
    for (const p of changes) {
      const name = p.slice(0, p.indexOf(':'))
      const after = propsB.find((q) => q.startsWith(`${name}:`)) ?? ''
      report.push(`    ${name}: ${p.slice(name.length + 1)}  →  ${after.slice(name.length + 1)}`)
    }
  }
  for (const path of b.keys()) {
    if (a.has(path)) continue
    elements++
    report.push(`+ ${path}（只在 B 中）`)
  }
  return { elements, report }
}

/** 两份状态扫描的差异：只在一边出现的行。 */
function compareStates(fileA: string, fileB: string) {
  const lines = (file: string) => readText(file).split('\n').filter(Boolean)
  const count = (list: readonly string[]) => {
    const map = new Map<string, number>()
    for (const line of list) map.set(line, (map.get(line) ?? 0) + 1)
    return map
  }
  const a = count(lines(fileA))
  const b = count(lines(fileB))
  const report: string[] = []
  for (const [line, n] of a) for (let k = b.get(line) ?? 0; k < n; k++) report.push(`- ${line}`)
  for (const [line, n] of b) for (let k = a.get(line) ?? 0; k < n; k++) report.push(`+ ${line}`)
  return report.sort((x, y) => x.slice(2).localeCompare(y.slice(2)) || x.localeCompare(y))
}

async function diff(dirA: string, dirB: string, options: Map<string, string>) {
  const threshold = numberOption(options, 'threshold', THRESHOLD)
  const tolerance = numberOption(options, 'tolerance', TOLERANCE)
  const out = resolve(
    options.get('out') ?? join(dirname(dirB), `diff-${basename(dirA)}-${basename(dirB)}`),
  )
  mkdirSync(out, { recursive: true })
  const pngs = (dir: string) =>
    new Set(
      readdirSync(dir)
        .filter((f) => f.endsWith('.png'))
        .map((f) => f.slice(0, -4)),
    )
  const inA = pngs(dirA)
  const inB = pngs(dirB)
  const names = [...new Set([...inA, ...inB])].sort()
  console.log(
    `阈值：任一通道相差超过 ${tolerance}/255 的像素算变化；变化的像素不超过全图的 ${threshold}% 算相同\n`,
  )
  const rows: { name: string; percent: number; status: string; styles: string; states: string }[] =
    []
  const browser = await launch()
  try {
    const page = await browser.newPage()
    for (const name of names) {
      if (!inA.has(name) || !inB.has(name)) {
        const status = inA.has(name) ? '只在 A 中' : '只在 B 中'
        rows.push({ name, percent: 100, status, styles: '', states: '' })
        continue
      }
      const result = await page.evaluate(comparePixels, {
        a: readFileSync(join(dirA, `${name}.png`)).toString('base64'),
        b: readFileSync(join(dirB, `${name}.png`)).toString('base64'),
        tolerance,
      })
      const percent = (result.changed / (result.width * result.height)) * 100
      const equal = result.sameSize && percent <= threshold
      if (result.diff)
        writeFileSync(join(out, `${name}.diff.png`), Buffer.from(result.diff, 'base64'))
      let styles = ''
      const stylesA = join(dirA, `${name}.styles.txt.gz`)
      const stylesB = join(dirB, `${name}.styles.txt.gz`)
      if (existsSync(stylesA) && existsSync(stylesB)) {
        const { elements, report } = compareStyles(stylesA, stylesB)
        styles = String(elements)
        if (elements) writeFileSync(join(out, `${name}.styles-diff.txt`), `${report.join('\n')}\n`)
      }
      let states = ''
      const statesA = join(dirA, `${name}.states.txt.gz`)
      const statesB = join(dirB, `${name}.states.txt.gz`)
      if (existsSync(statesA) && existsSync(statesB)) {
        const report = compareStates(statesA, statesB)
        states = String(report.length)
        if (report.length)
          writeFileSync(join(out, `${name}.states-diff.txt`), `${report.join('\n')}\n`)
      }
      rows.push({
        name,
        percent,
        status: equal ? '相同' : result.sameSize ? '不同' : '尺寸不同',
        styles,
        states,
      })
    }
  } finally {
    await browser.close()
  }
  const width = Math.max(...rows.map((r) => r.name.length))
  console.log(`${'截图'.padEnd(width)}  变化像素   结果    样式差异  状态差异`)
  for (const r of rows)
    console.log(
      `${r.name.padEnd(width)}  ${`${r.percent.toFixed(4)}%`.padStart(9)}  ${r.status.padEnd(6)}  ${r.styles.padStart(6)}  ${r.states.padStart(6)}`,
    )
  const different = rows.filter((r) => r.status !== '相同')
  const styled = rows.filter((r) => r.styles && r.styles !== '0')
  const stated = rows.filter((r) => r.states && r.states !== '0')
  console.log(
    `\n${rows.length} 张截图：${rows.length - different.length} 张相同，${different.length} 张不同；` +
      `计算样式有差异的 ${styled.length} 张，状态扫描有差异的 ${stated.length} 张。差异图与明细在 ${out}`,
  )
  if (different.length) process.exitCode = 1
}

// —— 入口 ——

const [command, ...rest] = process.argv.slice(2)
const { positional, options } = parseArgs(rest)
if (command === 'shoot') {
  const outDir = resolve(positional[0] ?? join(tmpdir(), 'vellum-visual', 'latest'))
  const siteDir = resolve(options.get('site') ?? join(pkgRoot, 'site/dist'))
  await shoot(outDir, siteDir, options.get('only'))
} else if (command === 'diff' && positional.length === 2) {
  await diff(resolve(positional[0] as string), resolve(positional[1] as string), options)
} else {
  console.error(
    [
      '用法：',
      '  node scripts/visual-snapshots.ts shoot [outDir] [--site <dir>] [--only <子串>]',
      '  node scripts/visual-snapshots.ts diff <dirA> <dirB> [--threshold <百分比>] [--tolerance <0–255>] [--out <dir>]',
    ].join('\n'),
  )
  process.exitCode = 2
}
