import { type KeyboardEvent, useState } from 'react'
import {
  Avatar,
  Box,
  Breadcrumb,
  Button,
  CountBadge,
  Descriptions,
  Drawer,
  EmptyState,
  Icon,
  IconButton,
  type IconName,
  Inline,
  Input,
  InputNumber,
  Lightbox,
  LinkButton,
  Panel,
  Pill,
  Progress,
  Segmented,
  Spacer,
  Stack,
  StatusDot,
  Tabs,
  Text,
  useMessage,
} from 'vellum-ui'
import styles from './ProductPage.module.css'

// —— Data of the recipe: replace with your catalog API ——

/** The colors of a product photo. They belong to the photo, not to the theme, so they are fixed values. */
interface Shades {
  readonly body: string
  readonly shade: string
  readonly deep: string
  readonly light: string
  readonly bg: string
}

const shades = (hue: number, l = 0.6, c = 0.09): Shades => ({
  body: `oklch(${l} ${c} ${hue})`,
  shade: `oklch(${l - 0.08} ${c * 0.92} ${hue})`,
  deep: `oklch(${l - 0.2} ${c * 0.7} ${hue})`,
  light: `oklch(0.95 0.025 ${hue})`,
  bg: `oklch(0.95 0.015 ${hue})`,
})

type SizeId = 'S/M' | 'M/L'
const SIZES: readonly SizeId[] = ['S/M', 'M/L']
const TORSO: Record<SizeId, string> = { 'S/M': 'torso 38 to 46 cm', 'M/L': 'torso 44 to 52 cm' }

interface Variant {
  readonly id: string
  readonly name: string
  readonly shades: Shades
  /** Units in stock per size. */
  readonly stock: Record<SizeId, number>
}

// biome-ignore format: one color per line reads as a table
const VARIANTS: readonly Variant[] = [
  { id: 'moss', name: 'Moss', shades: shades(135, 0.56, 0.075), stock: { 'S/M': 14, 'M/L': 3 } },
  { id: 'clay', name: 'Clay', shades: shades(42, 0.64, 0.12), stock: { 'S/M': 6, 'M/L': 0 } },
  { id: 'slate', name: 'Slate', shades: shades(250, 0.52, 0.045), stock: { 'S/M': 22, 'M/L': 9 } },
  { id: 'sand', name: 'Sand', shades: shades(80, 0.8, 0.055), stock: { 'S/M': 0, 'M/L': 2 } },
]

const PRODUCT = { name: 'Ridgeline Daypack 22L', price: 129, was: 159, rating: 4.6, reviews: 318 }
const FREE_SHIPPING = 150
const VIEWS = ['Front', 'Back', 'Detail', 'On the trail'] as const

// —— Generated product photos, so that the recipe runs without real images or a network ——

const WEB = 'oklch(0.28 0.01 250)' // the black webbing of straps and handles
const svg = (inner: string, bg: string, box = 800) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}"><rect width="${box}" height="${box}" fill="${bg}"/>${inner}</svg>`,
  )}`
const SHADOW = '<ellipse cx="400" cy="700" rx="230" ry="24" fill="oklch(0.2 0 0 / 0.14)"/>'
const HANDLE = `<path d="M352 184C352 118 448 118 448 184" fill="none" stroke="${WEB}" stroke-width="16" stroke-linecap="round"/>`
const BODY =
  'M240 310C240 200 300 170 400 170S560 200 560 310L568 620C570 668 540 690 500 690H300C260 690 230 668 232 620Z'

/** The pack from the front, without a background, so that the trail scene can reuse it. */
const packFront = (c: Shades) => `${SHADOW}${HANDLE}
  <path d="M258 252C196 330 200 520 246 640M542 252C604 330 600 520 554 640" fill="none" stroke="${WEB}" stroke-width="26" stroke-linecap="round"/>
  <path d="${BODY}" fill="${c.body}"/>
  <path d="M240 310C240 200 300 170 400 170S560 200 560 310C510 344 290 344 240 310Z" fill="${c.shade}"/>
  <path d="M266 304C330 330 470 330 534 304" fill="none" stroke="${c.deep}" stroke-width="5" stroke-linecap="round"/>
  <rect x="290" y="440" width="220" height="214" rx="46" fill="${c.shade}"/>
  <rect x="302" y="452" width="196" height="190" rx="36" fill="none" stroke="${c.light}" stroke-opacity="0.35" stroke-width="2" stroke-dasharray="7 7"/>
  <path d="M322 482H478" stroke="${c.deep}" stroke-width="6" stroke-linecap="round"/><rect x="460" y="478" width="14" height="44" rx="7" fill="${WEB}"/>
  <path d="M276 236V640M524 236V640" stroke="${WEB}" stroke-width="12" stroke-opacity="0.85"/>
  <rect x="262" y="372" width="28" height="22" rx="5" fill="${WEB}"/><rect x="510" y="372" width="28" height="22" rx="5" fill="${WEB}"/>
  <rect x="364" y="372" width="72" height="32" rx="9" fill="${c.light}"/>
  <path d="M378 396l12-13 8 8 7-7 12 12" fill="none" stroke="${c.deep}" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M262 330C256 420 258 540 270 620" stroke="oklch(1 0 0 / 0.14)" stroke-width="18" fill="none" stroke-linecap="round"/>`

const ART: Record<(typeof VIEWS)[number], (c: Shades) => string> = {
  Front: (c) => svg(packFront(c), c.bg),
  Back: (c) =>
    svg(
      `${SHADOW}${HANDLE}<path d="${BODY}" fill="${c.shade}"/>
      <rect x="290" y="250" width="220" height="200" rx="60" fill="${c.deep}"/><rect x="290" y="470" width="220" height="170" rx="60" fill="${c.deep}"/>
      <path d="M330 220C300 330 300 450 270 600M470 220C500 330 500 450 530 600" fill="none" stroke="${WEB}" stroke-width="46" stroke-linecap="round"/>
      <path d="M318 410H482" stroke="${WEB}" stroke-width="10"/><rect x="384" y="398" width="32" height="24" rx="6" fill="${c.light}"/>
      <path d="M232 600C300 640 500 640 568 600" fill="none" stroke="${WEB}" stroke-width="20" stroke-linecap="round"/>`,
      c.bg,
    ),
  Detail: (c) =>
    svg(
      `<rect x="40" y="60" width="720" height="780" rx="120" fill="${c.body}"/><rect x="120" y="300" width="560" height="560" rx="100" fill="${c.shade}"/>
      <rect x="146" y="326" width="508" height="520" rx="80" fill="none" stroke="${c.light}" stroke-opacity="0.4" stroke-width="4" stroke-dasharray="14 12"/>
      <path d="M180 400H620" stroke="${WEB}" stroke-width="22" stroke-linecap="round"/>
      <path d="M190 400H610" stroke="${c.light}" stroke-opacity="0.5" stroke-width="8" stroke-dasharray="4 10"/>
      <rect x="560" y="380" width="44" height="130" rx="22" fill="${WEB}"/><circle cx="582" cy="480" r="10" fill="${c.bg}"/>
      <rect x="290" y="150" width="220" height="90" rx="24" fill="${c.light}"/>
      <path d="M336 218l36-40 24 24 22-22 36 36" fill="none" stroke="${c.deep}" stroke-width="9" stroke-linejoin="round"/>`,
      c.bg,
    ),
  'On the trail': (c) =>
    svg(
      `<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="oklch(0.86 0.05 230)"/><stop offset="1" stop-color="${c.bg}"/></linearGradient></defs>
      <rect width="800" height="800" fill="url(#sky)"/><circle cx="600" cy="190" r="56" fill="oklch(0.97 0.04 90)"/>
      <path d="M0 470L170 290L300 410L450 240L620 420L800 300V800H0Z" fill="oklch(0.62 0.03 250)"/>
      <path d="M0 560L200 430L380 540L560 450L800 560V800H0Z" fill="oklch(0.5 0.05 160)"/>
      <path d="M0 690Q400 610 800 690V800H0Z" fill="oklch(0.42 0.045 150)"/>
      <g transform="translate(250 300) scale(0.6)">${packFront(c)}</g>`,
      c.bg,
    ),
}

/** A round chip of the color, half in its shade, for the swatches. */
const swatchArt = (c: Shades) =>
  svg(`<path d="M0 20A20 20 0 0 0 40 20Z" fill="${c.shade}"/>`, c.body, 40)

interface Related {
  readonly id: string
  readonly name: string
  readonly price: number
  readonly colors: number
  readonly src: string
}

const [BLUE, ORANGE, RED, GREEN] = [shades(220), shades(42), shades(10, 0.62), shades(160)]
// biome-ignore format: one product per line reads as a table
const RELATED: readonly Related[] = [
  { id: 'bottle', name: 'Trail Bottle 750 ml', price: 24, colors: 3, src: svg(`<rect x="320" y="180" width="160" height="480" rx="60" fill="${BLUE.body}"/><rect x="350" y="120" width="100" height="80" rx="20" fill="${WEB}"/><rect x="320" y="360" width="160" height="120" fill="${BLUE.light}"/>`, BLUE.bg) },
  { id: 'hip', name: 'Scramble Hip Pack 3L', price: 49, colors: 4, src: svg(`<path d="M80 420Q400 330 720 420" stroke="${WEB}" stroke-width="26" fill="none"/><rect x="220" y="330" width="360" height="200" rx="100" fill="${ORANGE.body}"/><path d="M270 400Q400 370 530 400" stroke="${ORANGE.deep}" stroke-width="8" fill="none"/>`, ORANGE.bg) },
  { id: 'beanie', name: 'Merino Rib Beanie', price: 32, colors: 5, src: svg(`<path d="M220 520C220 300 580 300 580 520Z" fill="${RED.body}"/><rect x="200" y="500" width="400" height="110" rx="30" fill="${RED.shade}"/><circle cx="400" cy="270" r="60" fill="${RED.light}"/>`, RED.bg) },
  { id: 'mug', name: 'Basecamp Enamel Mug', price: 18, colors: 2, src: svg(`<path d="M520 360h50a60 60 0 0 1 0 140h-50" stroke="${GREEN.deep}" stroke-width="30" fill="none"/><rect x="260" y="300" width="280" height="300" rx="34" fill="${GREEN.body}"/><rect x="260" y="300" width="280" height="40" rx="20" fill="${GREEN.light}"/>`, GREEN.bg) },
]

interface Review {
  readonly id: string
  readonly name: string
  readonly rating: number
  /** An ISO date. */
  readonly date: string
  readonly title: string
  readonly body: string
  readonly bought: string
  readonly helpful: number
}

// biome-ignore format: one review per line reads as a table
const REVIEWS: readonly Review[] = [
  { id: 'r1', name: 'Maya Torres', rating: 5, date: '2026-10-28', title: 'My everyday pack now', body: 'Commutes, day hikes, a weekend away with a packing cube: it does all of it. The lid pocket swallows a phone, keys and snacks, and the back panel stays cool.', bought: 'Moss, S/M', helpful: 24 },
  { id: 'r2', name: 'Daniel Okafor', rating: 5, date: '2026-10-12', title: 'Rain proof, as promised', body: 'Walked two hours in steady rain and the laptop sleeve was bone dry. The color is a little darker in person, which I prefer.', bought: 'Slate, M/L', helpful: 17 },
  { id: 'r3', name: 'Lena Fischer', rating: 4, date: '2026-11-02', title: 'Great fit, wish it had a hip belt pocket', body: 'Carries a full load without digging into the shoulders. A small pocket on the belt would make it perfect.', bought: 'Clay, S/M', helpful: 9 },
  { id: 'r4', name: 'Sam Whitaker', rating: 4, date: '2026-09-30', title: 'Solid build', body: 'Zips are smooth and the fabric feels like it will last. Side pockets fit a 750 ml bottle; a 1 liter one is a stretch.', bought: 'Sand, M/L', helpful: 6 },
  { id: 'r5', name: 'Priya Natarajan', rating: 3, date: '2026-10-05', title: 'Smaller than it looks', body: 'Well made, but 22 liters fills up quickly with a jacket. Consider the 30 liter if you carry layers.', bought: 'Moss, M/L', helpful: 11 },
  { id: 'r6', name: 'Chris Albright', rating: 2, date: '2026-08-21', title: 'Strap buckle came loose', body: 'One sternum buckle slipped after a month. Support replaced it within a week: two stars for the pack, full marks for the service.', bought: 'Slate, S/M', helpful: 3 },
]

/** How many reviews gave each number of stars, from 5 to 1. */
const DISTRIBUTION = [232, 58, 15, 7, 6].map((n, i) => ({ stars: 5 - i, n }))

const PERKS: readonly { readonly icon: IconName; readonly title: string; readonly hint: string }[] =
  [
    { icon: 'truck', title: 'Free shipping', hint: `On orders over $${FREE_SHIPPING}` },
    { icon: 'rotate-ccw', title: 'Free 60-day returns', hint: 'Worn outside? Still fine' },
    { icon: 'shield', title: 'Lifetime warranty', hint: 'We repair it, or replace it' },
  ]

const HIGHLIGHTS = [
  { figure: '22 L', text: "A day's kit, a rain shell and a 16 inch laptop." },
  { figure: '840 g', text: 'Lighter than a full liter bottle, frame sheet included.' },
  { figure: '100%', text: 'Recycled nylon shell with a PFC-free waterproof finish.' },
]

interface CartLine {
  readonly id: string
  readonly name: string
  readonly variant: string
  readonly price: number
  readonly qty: number
  readonly max: number
  readonly src: string
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const longDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// —— Small parts of our own ——

const STAR = 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z'
const HALF_STAR = 'M12 2L8.9 8.3 2 9.3l5 4.9L5.8 21 12 17.8z'

/** Rating stars filled to the nearest half. The star of the icon set is an outline, so these are ours. */
function Stars(props: { readonly value: number; readonly size?: 'sm' | 'md' | 'lg' }) {
  const { value, size = 'md' } = props
  return (
    <span
      className={styles.stars}
      data-size={size}
      role="img"
      aria-label={`${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = value >= n - 0.25 ? STAR : value >= n - 0.75 ? HALF_STAR : null
        return (
          <svg key={n} viewBox="0 0 24 24" aria-hidden="true">
            <path className={styles.starTrack} d={STAR} />
            {fill && <path className={styles.starFill} d={fill} />}
          </svg>
        )
      })}
    </span>
  )
}

/** Arrow keys move the choice within a radio group, and the focus follows the checked radio. */
function onRadioKeys<T>(
  e: KeyboardEvent<HTMLElement>,
  list: readonly T[],
  current: T,
  select: (v: T) => void,
) {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  if (!step) return
  e.preventDefault()
  select(list[(list.indexOf(current) + step + list.length) % list.length] as T)
  const group = e.currentTarget
  requestAnimationFrame(() => group.querySelector<HTMLElement>('[aria-checked="true"]')?.focus())
}

// —— The page ——

/**
 * Product page
 * The product page of an online outdoor store, airy like a storefront rather than an admin tool: large product
 * photos that change with the chosen color, display-size type for the name and the price, larger radii and a
 * calm canvas. A slim store header with a cart button, a Breadcrumb, a gallery that opens a Lightbox, color
 * swatches and size choices of our own (radio groups with arrow keys), an InputNumber for the quantity and a
 * stock note; "Add to cart" shows `loading`, then opens a Drawer with the cart: quantities, removal with undo, a
 * free-shipping Progress and checkout. Below: highlights in large figures, Tabs with details, care and shipping,
 * reviews with a star distribution that filters the list, and a row of related products.
 * @zh 商品详情页
 * 户外用品网店的商品详情页，是轻盈的店铺风格而不是后台：随所选颜色变化的大幅商品图，名称与价格用展示级字号，
 * 更大的圆角与安静的画布。精简的店铺顶栏带购物车按钮，Breadcrumb，点击打开 Lightbox 的图集，自己实现的颜色色块与
 * 尺码选择（支持方向键的单选组），数量用 InputNumber 并附库存提示；“加入购物车”先显示 `loading`，再打开装着购物车
 * 的 Drawer：改数量、可撤销的移除、包邮进度 Progress 与结算。下方是大号数字的亮点、详情 / 保养 / 配送的 Tabs、
 * 可按星级筛选列表的评分分布与评价，以及一排相关商品。
 * @level scenario
 */
export function ProductPage() {
  const message = useMessage()
  const [variant, setVariant] = useState<Variant>(VARIANTS[0] as Variant)
  const [size, setSize] = useState<SizeId>('S/M')
  const [qty, setQty] = useState(1)
  const [view, setView] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [cart, setCart] = useState<readonly CartLine[]>([
    {
      id: 'bottle',
      name: 'Trail Bottle 750 ml',
      variant: 'Glacier',
      price: 24,
      qty: 1,
      max: 10,
      src: RELATED[0]?.src ?? '',
    },
  ])
  const [starFilter, setStarFilter] = useState<number | null>(null)
  const [sort, setSort] = useState<'helpful' | 'newest'>('helpful')
  const [helpful, setHelpful] = useState<ReadonlySet<string>>(new Set())

  const photos = VIEWS.map((v) => ({
    id: `${variant.id}-${v}`,
    src: ART[v](variant.shades),
    alt: `${PRODUCT.name} in ${variant.name}, ${v.toLowerCase()}`,
  }))
  const stock = variant.stock[size]
  const quantity = Math.min(qty, Math.max(stock, 1))
  const count = cart.reduce((n, l) => n + l.qty, 0)
  const subtotal = cart.reduce((n, l) => n + l.price * l.qty, 0)
  const toFree = FREE_SHIPPING - subtotal
  const stockNote =
    stock === 0
      ? ({ tone: 'danger', text: `Sold out in ${variant.name}, ${size}` } as const)
      : stock <= 5
        ? ({ tone: 'warning', text: `Only ${stock} left, order soon` } as const)
        : ({ tone: 'success', text: 'In stock, ships in 1 to 2 business days' } as const)
  const reviews = REVIEWS.filter((r) => starFilter === null || r.rating === starFilter).sort(
    (a, b) => (sort === 'newest' ? b.date.localeCompare(a.date) : b.helpful - a.helpful),
  )

  // A real store navigates here, with the router of the application
  const open = (what: string) => message.info(`Open ${what} here`)

  /** Adds a line, or more of a line that is already in the cart. */
  const putInCart = (line: CartLine) =>
    setCart((lines) =>
      lines.some((l) => l.id === line.id)
        ? lines.map((l) =>
            l.id === line.id ? { ...l, qty: Math.min(l.max, l.qty + line.qty) } : l,
          )
        : [...lines, line],
    )

  async function addToCart() {
    setAdding(true)
    await wait(800) // the request to the cart API
    putInCart({
      id: `pack-${variant.id}-${size}`,
      name: PRODUCT.name,
      variant: `${variant.name}, ${size}`,
      price: PRODUCT.price,
      qty: quantity,
      max: stock,
      src: ART.Front(variant.shades),
    })
    setAdding(false)
    setCartOpen(true)
  }

  function remove(line: CartLine) {
    const at = cart.indexOf(line)
    setCart((lines) => lines.filter((l) => l.id !== line.id))
    message.undoable({
      content: `Removed ${line.name}`,
      onUndo: () => setCart((lines) => [...lines.slice(0, at), line, ...lines.slice(at)]),
    })
  }

  async function checkout() {
    setCheckingOut(true)
    await wait(900)
    setCheckingOut(false)
    setCartOpen(false)
    message.success('Checkout opens here')
  }

  return (
    <div className={styles.store} data-variant={variant.id}>
      <p className={styles.promo}>Free shipping over ${FREE_SHIPPING} and free 60-day returns</p>

      <header className={styles.bar}>
        <button
          type="button"
          className={styles.logo}
          data-vl-state=""
          onClick={() => open('the home page')}
        >
          <span className={styles.logoMark} aria-hidden="true" />
          Fieldnote
        </button>
        <nav className={styles.cats} aria-label="Categories">
          {['Packs', 'Apparel', 'Camp', 'Hydration', 'Sale'].map((c) => (
            <button
              key={c}
              type="button"
              className={styles.cat}
              data-vl-state=""
              aria-current={c === 'Packs' ? 'page' : undefined}
              onClick={() => open(c)}
            >
              {c}
            </button>
          ))}
        </nav>
        <div className={styles.search}>
          <Input.Search
            placeholder="Search the store"
            aria-label="Search the store"
            onSearch={(q) => q && open(`the results for "${q}"`)}
          />
        </div>
        {/* The icon set has no bag, so the cart draws one with the stroke of the other icons */}
        <button
          type="button"
          className={styles.cart}
          data-vl-state=""
          aria-label={`Cart, ${count} items`}
          onClick={() => setCartOpen(true)}
        >
          <svg className={styles.bag} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" />
          </svg>
          <span className={styles.cartCount}>
            <CountBadge count={count} tone="accent" />
          </span>
        </button>
      </header>

      <Breadcrumb
        items={[
          { title: 'Home', onClick: () => open('the home page') },
          { title: 'Packs', onClick: () => open('Packs') },
          { title: 'Daypacks', onClick: () => open('Daypacks') },
          { title: PRODUCT.name },
        ]}
      />

      <div className={styles.hero}>
        <section className={styles.gallery} aria-label="Photos">
          <div className={styles.stage}>
            <button
              type="button"
              className={styles.main}
              data-vl-state=""
              aria-label={`Enlarge: ${photos[view]?.alt}`}
              onClick={() => setViewerOpen(true)}
            >
              <img src={photos[view]?.src} alt="" />
            </button>
            <span className={styles.badge}>
              <Pill tone="accent">New color: Clay</Pill>
            </span>
            <span className={styles.zoomHint} aria-hidden="true">
              <Icon name="scan-search" size={14} /> Click to enlarge
            </span>
          </div>
          <div className={styles.thumbs}>
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={styles.thumb}
                data-vl-state=""
                aria-pressed={i === view}
                aria-label={`Photo ${i + 1}: ${VIEWS[i]}`}
                onClick={() => setView(i)}
              >
                <img src={p.src} alt="" />
              </button>
            ))}
          </div>
        </section>

        <div className={styles.buy}>
          <Stack gap={3}>
            <Text overline>Fieldnote Packs</Text>
            <h1 className={styles.name}>{PRODUCT.name}</h1>
            <Inline gap={2}>
              <Stars value={PRODUCT.rating} />
              <Text weight="semibold" numeric>
                {PRODUCT.rating}
              </Text>
              <LinkButton
                onClick={() =>
                  document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                {PRODUCT.reviews} reviews
              </LinkButton>
            </Inline>
          </Stack>

          <div className={styles.priceRow}>
            <span className={styles.price}>{dollars.format(PRODUCT.price)}</span>
            <s className={styles.was}>
              <span className={styles.hidden}>Was </span>
              {dollars.format(PRODUCT.was)}
            </s>
            <Pill tone="danger">Save {Math.round((1 - PRODUCT.price / PRODUCT.was) * 100)}%</Pill>
          </div>
          <Text as="p" tone="secondary">
            A weatherproof everyday pack with a padded laptop sleeve, a quick-access lid pocket and
            a breathable back panel. The commute on weekdays, the ridge on weekends.
          </Text>

          <Stack gap={3}>
            <Text weight="semibold" id="color-label">
              Color <span className={styles.chosen}>{variant.name}</span>
            </Text>
            <div
              className={styles.choices}
              role="radiogroup"
              aria-labelledby="color-label"
              onKeyDown={(e) => onRadioKeys(e, VARIANTS, variant, setVariant)}
            >
              {VARIANTS.map((v) => (
                // biome-ignore lint/a11y/useSemanticElements: a swatch shows an image; the radio role keeps its group semantics
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={v.id === variant.id}
                  aria-label={v.name}
                  tabIndex={v.id === variant.id ? 0 : -1}
                  className={styles.swatch}
                  data-vl-state=""
                  onClick={() => setVariant(v)}
                >
                  <img src={swatchArt(v.shades)} alt="" />
                </button>
              ))}
            </div>
          </Stack>

          <Stack gap={3}>
            <Text weight="semibold" id="size-label">
              Size <span className={styles.chosen}>Fits a {TORSO[size]}</span>
            </Text>
            <div
              className={styles.choices}
              role="radiogroup"
              aria-labelledby="size-label"
              onKeyDown={(e) => onRadioKeys(e, SIZES, size, setSize)}
            >
              {SIZES.map((s) => (
                // biome-ignore lint/a11y/useSemanticElements: a pill-shaped choice; the radio role keeps its group semantics
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === size}
                  aria-label={variant.stock[s] === 0 ? `${s}, sold out` : s}
                  tabIndex={s === size ? 0 : -1}
                  className={styles.size}
                  data-vl-state=""
                  data-soldout={variant.stock[s] === 0 || undefined}
                  onClick={() => setSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </Stack>

          <div className={styles.purchase}>
            <InputNumber
              size="lg"
              min={1}
              max={Math.max(stock, 1)}
              value={quantity}
              onChange={(n) => setQty(n ?? 1)}
              disabled={stock === 0}
              aria-label="Quantity"
            />
            <Button
              variant="primary"
              size="lg"
              block
              loading={adding}
              disabled={stock === 0}
              disabledReason="Choose another size or color"
              onClick={addToCart}
            >
              {adding ? 'Adding' : `Add to cart, ${dollars.format(PRODUCT.price * quantity)}`}
            </Button>
          </div>
          <Inline gap={2}>
            <StatusDot tone={stockNote.tone} />
            <Text size="sm" tone="secondary">
              {stockNote.text}
            </Text>
          </Inline>

          <Box surface="sunken" radius="xl" padding={4}>
            <Stack gap={3}>
              {PERKS.map((p) => (
                <Inline key={p.title} gap={3}>
                  <Icon name={p.icon} size={18} tone="secondary" />
                  <Text size="sm" weight="semibold">
                    {p.title}
                  </Text>
                  <Text size="sm" tone="secondary">
                    {p.hint}
                  </Text>
                </Inline>
              ))}
            </Stack>
          </Box>
        </div>
      </div>

      <section className={styles.highlights} aria-label="Highlights">
        {HIGHLIGHTS.map((h) => (
          <Stack key={h.figure} gap={2}>
            <span className={styles.figure}>{h.figure}</span>
            <Text tone="secondary">{h.text}</Text>
          </Stack>
        ))}
      </section>

      <section className={styles.split}>
        <div className={styles.side}>
          <h2 className={styles.title} data-size="lg">
            Made for the in-between days
          </h2>
          <Text as="p" tone="secondary">
            Too much for a tote, not enough for a trekking pack. Structured enough to carry a
            laptop, soft enough to squash under a train seat.
          </Text>
        </div>
        <div className={styles.wide}>
          <Tabs
            items={[
              {
                key: 'details',
                label: 'Details',
                children: (
                  <Descriptions
                    column={2}
                    items={[
                      { label: 'Volume', children: '22 liters' },
                      { label: 'Weight', children: '840 g' },
                      { label: 'Dimensions', children: '48 x 29 x 18 cm' },
                      { label: 'Laptop sleeve', children: 'Up to 16 inch' },
                      {
                        label: 'Sizes',
                        children: SIZES.map((s) => `${s}: ${TORSO[s]}`).join('; '),
                      },
                      { label: 'Pockets', children: 'Lid, front, two side, sleeve' },
                    ]}
                  />
                ),
              },
              {
                key: 'care',
                label: 'Materials and care',
                children: (
                  <Stack gap={2}>
                    <Text as="p">
                      Shell: 210D recycled nylon ripstop with a PFC-free waterproof finish. Lining:
                      recycled polyester. Back panel: open-cell foam under air mesh.
                    </Text>
                    <Text as="p" tone="secondary">
                      Brush off dirt when dry, spot clean with mild soap and cold water, and hang to
                      dry away from heat. Do not machine wash.
                    </Text>
                  </Stack>
                ),
              },
              {
                key: 'shipping',
                label: 'Shipping and returns',
                children: (
                  <Stack gap={2}>
                    <Text as="p">
                      Free standard shipping over ${FREE_SHIPPING}, in 3 to 5 business days; express
                      in 1 to 2 business days for $12.
                    </Text>
                    <Text as="p" tone="secondary">
                      Return anything within 60 days, used or not: print a free label from your
                      order page, or drop it off at one of our stores.
                    </Text>
                  </Stack>
                ),
              },
            ]}
          />
        </div>
      </section>

      <section className={styles.split} id="reviews" aria-labelledby="reviews-title">
        <div className={styles.side}>
          <h2 className={styles.title} id="reviews-title">
            Reviews
          </h2>
          <Inline gap={4}>
            <span className={styles.figure}>{PRODUCT.rating}</span>
            <Stack gap={1}>
              <Stars value={PRODUCT.rating} size="lg" />
              <Text size="sm" tone="secondary">
                Based on {PRODUCT.reviews} reviews
              </Text>
            </Stack>
          </Inline>
          {/* Each row is a button that filters the list; Progress draws the share of the reviews */}
          <div className={styles.bars}>
            {DISTRIBUTION.map(({ stars, n }) => (
              <button
                key={stars}
                type="button"
                className={styles.barRow}
                data-vl-state=""
                aria-pressed={starFilter === stars}
                aria-label={`${stars} stars: ${n} reviews`}
                onClick={() => setStarFilter(starFilter === stars ? null : stars)}
              >
                <Text size="sm" numeric>
                  {stars}
                </Text>
                <Icon name="star" size={12} tone="tertiary" />
                <Progress
                  percent={(n / PRODUCT.reviews) * 100}
                  size="sm"
                  showValue={false}
                  aria-label={`${stars} stars`}
                />
                <Text size="sm" tone="secondary" numeric>
                  {n}
                </Text>
              </button>
            ))}
          </div>
          <Inline>
            <Button icon="edit" onClick={() => open('the review form')}>
              Write a review
            </Button>
          </Inline>
        </div>

        <div className={styles.wide}>
          <Stack gap={4}>
            <Inline gap={2} wrap>
              <Text tone="secondary">
                {starFilter === null ? 'All reviews' : `${starFilter}-star reviews`}
              </Text>
              {starFilter !== null && (
                <LinkButton onClick={() => setStarFilter(null)}>Show all</LinkButton>
              )}
              <Spacer />
              <Segmented
                size="sm"
                aria-label="Sort reviews"
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'helpful', label: 'Most helpful' },
                  { value: 'newest', label: 'Newest' },
                ]}
              />
            </Inline>
            {reviews.length === 0 && (
              <EmptyState
                size="sm"
                icon="star"
                title={`No ${starFilter}-star reviews on this page`}
                description="Your API returns the other pages."
              />
            )}
            {reviews.map((r) => {
              const marked = helpful.has(r.id)
              const toggle = () =>
                setHelpful((s) =>
                  marked ? new Set([...s].filter((id) => id !== r.id)) : new Set(s).add(r.id),
                )
              return (
                <Panel key={r.id} padding={5}>
                  <Stack gap={3}>
                    <Inline gap={3} wrap>
                      <Avatar name={r.name} size={36} />
                      <Stack gap={0}>
                        <Text weight="semibold">{r.name}</Text>
                        <Text size="xs" tone="secondary">
                          Bought {r.bought}
                        </Text>
                      </Stack>
                      <Spacer />
                      <Pill tone="success" icon="check">
                        Verified buyer
                      </Pill>
                    </Inline>
                    <Inline gap={2}>
                      <Stars value={r.rating} size="sm" />
                      <Text size="sm" tone="tertiary" as="time" dateTime={r.date}>
                        {longDate.format(new Date(r.date))}
                      </Text>
                    </Inline>
                    <h3 className={styles.reviewTitle}>{r.title}</h3>
                    <Text as="p" tone="secondary">
                      {r.body}
                    </Text>
                    <Inline>
                      <Button
                        size="sm"
                        variant="text"
                        icon="thumbs-up"
                        aria-pressed={marked}
                        onClick={toggle}
                      >
                        Helpful ({r.helpful + (marked ? 1 : 0)})
                      </Button>
                    </Inline>
                  </Stack>
                </Panel>
              )
            })}
          </Stack>
        </div>
      </section>

      <section className={styles.related} aria-labelledby="related-title">
        <h2 className={styles.title} id="related-title">
          You may also like
        </h2>
        <div className={styles.shelf}>
          {RELATED.map((p) => (
            <article key={p.id} className={styles.card}>
              <button
                type="button"
                className={styles.cardLink}
                data-vl-state=""
                onClick={() => open(p.name)}
              >
                <img src={p.src} alt="" />
                <Text weight="semibold">{p.name}</Text>
                <Text tone="secondary" size="sm">
                  {p.colors} colors
                </Text>
                <span className={styles.cardPrice}>{dollars.format(p.price)}</span>
              </button>
              <span className={styles.quickAdd}>
                <IconButton
                  icon="plus"
                  variant="soft"
                  label={`Add ${p.name} to cart`}
                  onClick={() => {
                    putInCart({ ...p, variant: 'Default color', qty: 1, max: 10 })
                    message.success(`Added ${p.name} to your cart`)
                  }}
                />
              </span>
            </article>
          ))}
        </div>
      </section>

      <Lightbox
        open={viewerOpen}
        items={photos}
        index={view}
        onIndexChange={setView}
        onClose={() => setViewerOpen(false)}
      />

      <Drawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={`Your cart (${count})`}
        width={420}
        footer={
          cart.length > 0 && (
            <Stack gap={3} grow>
              <Inline justify="between">
                <Text weight="semibold">Subtotal</Text>
                <span className={styles.subtotal}>{money.format(subtotal)}</span>
              </Inline>
              <Text size="xs" tone="secondary">
                Taxes and shipping are calculated at checkout.
              </Text>
              <Button variant="primary" size="lg" block loading={checkingOut} onClick={checkout}>
                Check out
              </Button>
            </Stack>
          )
        }
      >
        {cart.length === 0 ? (
          <EmptyState
            fill
            icon="package"
            title="Your cart is empty"
            description="Packs, layers and camp gear land here."
            action={<Button onClick={() => setCartOpen(false)}>Keep shopping</Button>}
          />
        ) : (
          <Stack gap={5}>
            <Box surface="sunken" radius="xl" padding={4}>
              <Stack gap={2}>
                <Text size="sm">
                  {toFree > 0
                    ? `You are ${money.format(toFree)} away from free shipping`
                    : 'Your order ships for free'}
                </Text>
                <Progress
                  percent={(subtotal / FREE_SHIPPING) * 100}
                  size="sm"
                  showValue={false}
                  tone={toFree > 0 ? 'accent' : 'success'}
                  aria-label="Free shipping"
                />
              </Stack>
            </Box>
            <Stack as="ul" gap={4}>
              {cart.map((l) => (
                <Inline as="li" key={l.id} align="start" gap={3}>
                  <img src={l.src} alt="" className={styles.lineArt} />
                  <Stack gap={2} grow>
                    <Inline align="start" gap={2}>
                      <Stack gap={0} grow>
                        <Text weight="semibold">{l.name}</Text>
                        <Text size="sm" tone="secondary">
                          {l.variant}
                        </Text>
                      </Stack>
                      <IconButton
                        icon="trash"
                        size="sm"
                        label={`Remove ${l.name}`}
                        onClick={() => remove(l)}
                      />
                    </Inline>
                    <Inline justify="between">
                      <InputNumber
                        size="sm"
                        min={1}
                        max={l.max}
                        value={l.qty}
                        aria-label={`Quantity of ${l.name}`}
                        onChange={(n) =>
                          setCart((lines) =>
                            lines.map((x) => (x.id === l.id ? { ...x, qty: n ?? 1 } : x)),
                          )
                        }
                      />
                      <Text weight="semibold" numeric>
                        {money.format(l.price * l.qty)}
                      </Text>
                    </Inline>
                  </Stack>
                </Inline>
              ))}
            </Stack>
          </Stack>
        )}
      </Drawer>
    </div>
  )
}
