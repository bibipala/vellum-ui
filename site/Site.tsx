/**
 * The documentation site of vellum-ui, built with vellum-ui: a top bar (search, language, color mode, density), a
 * sidebar with the navigation and the page. The route is in the hash, with the language first (see routes.ts).
 *
 * Color mode, density and language are saved on this device (`localStorage`); the language of a link always wins,
 * so a shared link opens in the language it was copied in.
 */
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  App,
  Box,
  Button,
  type ColorModePreference,
  CommandPalette,
  type CommandPaletteItem,
  type Density,
  type DocLanguage,
  Dropdown,
  Icon,
  IconButton,
  Inline,
  Kbd,
  ListItem,
  Pill,
  Segmented,
  Spacer,
  SplitView,
  Stack,
  Text,
  ThemeProvider,
  useHotkeys,
} from 'vellum-ui'
import pkg from '../package.json' with { type: 'json' }
import {
  apiPages,
  categories,
  components,
  guidePages,
  homePage,
  type MarkdownPageInfo,
  recipePages,
  tokensPage,
} from './content.ts'
import { ComponentPage } from './pages/ComponentPage.tsx'
import { MarkdownPage, markdownOf, NotFoundPage, RecipePage } from './pages/MarkdownPage.tsx'
import {
  hrefOf,
  LANGUAGES,
  languageOf,
  pageOfPath,
  pagePath,
  parseHash,
  pathWithoutLanguage,
  type Route,
  type SitePage,
  slugify,
} from './routes.ts'
import styles from './site.module.css'
import { TEXT } from './text.ts'

// —— Preferences saved on this device ——

const STORAGE_PREFIX = 'vellum-ui-docs:'

function readSetting<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_PREFIX + name)
    return allowed.find((a) => a === value) ?? fallback
  } catch {
    return fallback
  }
}

function saveSetting(name: string, value: string) {
  try {
    globalThis.localStorage?.setItem(STORAGE_PREFIX + name, value)
  } catch {
    // Storage is not available (such as in private browsing): the choice lasts for this visit only
  }
}

const COLOR_MODES: readonly ColorModePreference[] = ['light', 'dark', 'system']
const MODE_ICONS = { light: 'sun', dark: 'moon', system: 'monitor' } as const
const DENSITIES: readonly Density[] = ['comfortable', 'compact']

/** The language of a link without one: the saved choice, else the language of the browser. */
function preferredLanguage(): DocLanguage {
  const browser = globalThis.navigator?.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  return readSetting<DocLanguage>(
    'lang',
    LANGUAGES.map((l) => l.lang),
    browser,
  )
}

// —— Routing ——

/** The route of the address; a hash without a language gets the preferred one. */
function readRoute(): Route {
  const hash = globalThis.location?.hash ?? ''
  return (
    parseHash(hash) ?? {
      lang: preferredLanguage(),
      page: pageOfPath(pathWithoutLanguage(hash)),
      anchor: null,
    }
  )
}

/** The current route, following `hashchange`. */
function useHashRoute(): Route {
  const [route, setRoute] = useState(readRoute)
  useEffect(() => {
    const sync = () => {
      const next = readRoute()
      const href = hrefOf(next)
      // An address without a language is replaced (not pushed): it is not a page of its own
      if (globalThis.location.hash !== href) history.replaceState(history.state, '', href)
      setRoute(next)
    }
    sync()
    globalThis.addEventListener('hashchange', sync)
    return () => globalThis.removeEventListener('hashchange', sync)
  }, [])
  return route
}

const navigate = (route: Route) => {
  globalThis.location.hash = hrefOf(route)
}

const samePage = (a: SitePage, b: SitePage) => a.kind === b.kind && pagePath(a) === pagePath(b)

// —— Navigation ——

interface NavItem {
  readonly page: SitePage
  readonly label: string
}

interface NavGroup {
  readonly key: string
  readonly label: string | null
  readonly items: readonly NavItem[]
}

const fromMarkdown = (pages: readonly MarkdownPageInfo[], lang: DocLanguage): NavItem[] =>
  pages.map((p) => ({ page: p.page, label: p.title[lang] }))

function navGroups(lang: DocLanguage): NavGroup[] {
  const t = TEXT[lang]
  const groups: NavGroup[] = [
    { key: 'start', label: null, items: [{ page: { kind: 'home' }, label: t.overview }] },
    { key: 'guides', label: t.guides, items: fromMarkdown(guidePages, lang) },
    { key: 'recipes', label: t.recipes, items: fromMarkdown(recipePages, lang) },
    ...categories.map((cat) => ({
      key: `category-${cat.en}`,
      label: cat[lang],
      items: components
        .filter((c) => c.category.en === cat.en)
        .map((c) => ({ page: { kind: 'component', name: c.name } as const, label: c.name })),
    })),
    {
      key: 'api',
      label: t.api,
      items: [
        ...fromMarkdown(apiPages, lang),
        ...(tokensPage ? [{ page: tokensPage.page, label: t.tokens }] : []),
      ],
    },
  ]
  return groups.filter((g) => g.items.length > 0)
}

/**
 * The sidebar. Every entry is a button (ListItem), reached with `Tab`; inside the navigation, `↑` / `↓` move between
 * the entries and `Home` / `End` go to the first and the last.
 */
function Sidebar(props: {
  readonly lang: DocLanguage
  readonly current: SitePage
  readonly onSelect: (page: SitePage) => void
}) {
  const t = TEXT[props.lang]
  const ref = useRef<HTMLElement>(null)
  const groups = useMemo(() => navGroups(props.lang), [props.lang])

  // Bring the current entry into view when it is not, such as when a link opens a component far down the list
  const currentKey = `${props.current.kind}:${pagePath(props.current)}`
  useEffect(() => {
    const nav = ref.current
    const selected = nav?.querySelector(`[data-nav="${CSS.escape(currentKey)}"]`)
    const scroller = nav?.closest('aside') ?? nav?.parentElement
    if (!selected || !scroller) return
    const box = selected.getBoundingClientRect()
    const view = scroller.getBoundingClientRect()
    if (box.top < view.top || box.bottom > view.bottom) selected.scrollIntoView({ block: 'center' })
  }, [currentKey])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : Math.min(buttons.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)))
    event.preventDefault()
    buttons[next]?.focus()
  }

  return (
    <nav ref={ref} aria-label={t.navigation} onKeyDown={onKeyDown}>
      <Stack gap={5} padding={3}>
        {groups.map((g) => (
          <Stack key={g.key} gap={1}>
            {g.label && (
              <Box paddingX={3} paddingY={1}>
                <Text overline>{g.label}</Text>
              </Box>
            )}
            <Stack as="ul" gap={0} aria-label={g.label ?? undefined}>
              {g.items.map((item) => {
                const key = `${item.page.kind}:${pagePath(item.page)}`
                return (
                  <li key={key} data-nav={key}>
                    <ListItem
                      density="compact"
                      title={item.label}
                      selected={samePage(item.page, props.current)}
                      onClick={() => props.onSelect(item.page)}
                    />
                  </li>
                )
              })}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </nav>
  )
}

// —— Search ——

function searchItems(lang: DocLanguage, go: (page: SitePage, anchor?: string) => void) {
  const t = TEXT[lang]
  const other: DocLanguage = lang === 'en' ? 'zh' : 'en'
  const items: CommandPaletteItem[] = []
  const markdownItem = (p: MarkdownPageInfo, group: string, icon: CommandPaletteItem['icon']) => {
    items.push({
      id: hrefOf({ lang, page: p.page }),
      title: p.title[lang],
      group,
      icon,
      keywords: [p.title[other], ...p.headings[lang]],
      onSelect: () => go(p.page),
    })
  }
  if (homePage)
    markdownItem(
      { ...homePage, title: { en: TEXT.en.overview, zh: TEXT.zh.overview } },
      t.overview,
      'home',
    )
  for (const p of guidePages) markdownItem(p, t.guides, 'book')
  for (const p of recipePages) markdownItem(p, t.recipes, 'layers')
  for (const c of components)
    items.push({
      id: hrefOf({ lang, page: { kind: 'component', name: c.name } }),
      title: c.name,
      group: c.category[lang],
      icon: 'grid',
      keywords: [c.summary.en, c.summary.zh, c.usage.en, c.usage.zh],
      onSelect: () => go({ kind: 'component', name: c.name }),
    })
  for (const p of apiPages) {
    markdownItem(p, t.api, 'braces')
    // Each export of the API reference is an entry of its own, opening its heading on the page
    for (const h of p.headings[lang])
      items.push({
        id: hrefOf({ lang, page: p.page, anchor: slugify(h) }),
        title: h,
        group: t.api,
        icon: 'code',
        keywords: [p.title.en, p.title.zh],
        onSelect: () => go(p.page, slugify(h)),
      })
  }
  if (tokensPage) markdownItem(tokensPage, t.tokens, 'palette')
  return items
}

// —— Page ——

function PageFor(props: { readonly route: Route }) {
  const { lang, page } = props.route
  switch (page.kind) {
    case 'component': {
      const doc = components.find((c) => c.name === page.name)
      return doc ? <ComponentPage doc={doc} lang={lang} /> : <NotFoundPage lang={lang} />
    }
    case 'recipe': {
      const md = markdownOf(lang, page)
      return md ? (
        <RecipePage lang={lang} name={page.name} title={md.title} body={md.body} />
      ) : (
        <NotFoundPage lang={lang} />
      )
    }
    case 'missing':
      return <NotFoundPage lang={lang} />
    default: {
      const md = markdownOf(lang, page)
      return md ? (
        <MarkdownPage lang={lang} title={md.title} body={md.body} />
      ) : (
        <NotFoundPage lang={lang} />
      )
    }
  }
}

/** The title of a route, for `document.title`. */
function titleOf(route: Route): string {
  const t = TEXT[route.lang]
  const { page } = route
  if (page.kind === 'home') return t.siteName
  const name =
    page.kind === 'component'
      ? page.name
      : page.kind === 'missing'
        ? t.notFound
        : (markdownOf(route.lang, page)?.title ?? t.notFound)
  return `${name} · ${t.siteName}`
}

/** Waits until `find` returns an element (Markdown renders after its renderer has loaded), at most `timeout` ms. */
function whenFound(root: HTMLElement, find: () => HTMLElement | null, timeout = 3000) {
  return new Promise<HTMLElement | null>((resolve) => {
    const found = find()
    if (found) return resolve(found)
    const observer = new MutationObserver(() => {
      const el = find()
      if (!el) return
      observer.disconnect()
      clearTimeout(timer)
      resolve(el)
    })
    const timer = setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
    observer.observe(root, { childList: true, subtree: true })
  })
}

/** Focuses a heading without scrolling the page twice (headings are not focusable by themselves). */
function focusHeading(el: HTMLElement) {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll: true })
}

/**
 * After navigating: scroll to the top and move the focus to the page title, so that screen readers start at the new
 * page and `Tab` continues from there. With an anchor, scroll to that heading instead.
 */
function useFocusOnNavigate(route: Route, mainId: string) {
  const key = hrefOf(route)
  const anchor = route.anchor
  // The address handled last: the first page of a visit keeps the focus where the browser puts it, and an effect
  // that runs twice for the same address (StrictMode) does not move the focus again
  const handled = useRef<string | null>(null)
  useEffect(() => {
    const main = document.getElementById(mainId)
    const previous = handled.current
    handled.current = key
    if (!main) return
    if (anchor) {
      let cancelled = false
      void whenFound(
        main,
        () =>
          [...main.querySelectorAll<HTMLElement>('h2, h3, h4')].find(
            (h) => slugify(h.textContent ?? '') === anchor,
          ) ?? null,
      ).then((el) => {
        if (cancelled || !el) return
        // Leave the padding of the page above the heading, so that its focus ring is not cut off
        const gap = Number.parseFloat(getComputedStyle(main).paddingTop) || 0
        main.scrollTop += el.getBoundingClientRect().top - main.getBoundingClientRect().top - gap
        focusHeading(el)
      })
      return () => {
        cancelled = true
      }
    }
    if (previous === null || previous === key) return
    main.scrollTop = 0
    const h1 = main.querySelector<HTMLElement>('h1')
    if (h1) focusHeading(h1)
  }, [key, anchor, mainId])
}

/** Whether the window is wide enough for the sidebar next to the page. */
function useWide(): boolean {
  const query = '(min-width: 60em)'
  const [wide, setWide] = useState(() => globalThis.matchMedia?.(query).matches ?? true)
  useEffect(() => {
    const mql = globalThis.matchMedia?.(query)
    if (!mql) return
    const onChange = () => setWide(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return wide
}

const MAIN_ID = 'vl-docs-main'

function Shell(props: {
  readonly route: Route
  readonly colorMode: ColorModePreference
  readonly onColorModeChange: (mode: ColorModePreference) => void
  readonly density: Density
  readonly onDensityChange: (density: Density) => void
}) {
  const { route } = props
  const { lang } = route
  const t = TEXT[lang]
  const wide = useWide()
  const [navOpen, setNavOpen] = useState(wide)
  const [searchOpen, setSearchOpen] = useState(false)
  useEffect(() => setNavOpen(wide), [wide])

  const go = useCallback(
    (page: SitePage, anchor?: string) => {
      navigate({ lang, page, anchor: anchor ?? null })
      if (!wide) setNavOpen(false)
    },
    [lang, wide],
  )
  const setLanguage = (next: DocLanguage) => {
    saveSetting('lang', next)
    navigate({ ...route, lang: next })
  }

  useHotkeys('mod+k', () => setSearchOpen(true), { description: t.search })
  const items = useMemo(() => searchItems(lang, go), [lang, go])

  useEffect(() => {
    document.title = titleOf(route)
    document.documentElement.lang = languageOf(lang).htmlLang
  }, [route, lang])
  useFocusOnNavigate(route, MAIN_ID)

  const pageKey = hrefOf({ ...route, anchor: null })
  // The page is a surface next to the navigation on the canvas; examples sit on the canvas color inside it
  const main = (
    <Box as="main" id={MAIN_ID} surface="surface" grow scroll padding={6}>
      <PageFor key={pageKey} route={route} />
    </Box>
  )
  const sidebar = <Sidebar lang={lang} current={route.page} onSelect={(page) => go(page)} />

  let body: ReactNode
  if (!navOpen) body = main
  else if (!wide)
    body = (
      <Stack scroll grow>
        {sidebar}
      </Stack>
    )
  else
    body = (
      <SplitView variant="flush" asideWidth="sm" aside={sidebar}>
        {main}
      </SplitView>
    )

  return (
    <div className={styles.frame}>
      <Box as="header" paddingX={4} paddingY={2}>
        <Inline gap={3} wrap>
          <IconButton
            icon="sidebar"
            label={navOpen ? t.hideNavigation : t.showNavigation}
            active={navOpen}
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          />
          <Button variant="text" href={hrefOf({ lang, page: { kind: 'home' } })}>
            <Text weight="semibold">{t.siteName}</Text>
          </Button>
          <Pill>{pkg.version}</Pill>
          <Spacer />
          <Button icon="search" onClick={() => setSearchOpen(true)}>
            {t.search} <Kbd keys="mod+k" />
          </Button>
          <Segmented<DocLanguage>
            size="sm"
            aria-label={t.language}
            value={lang}
            onChange={setLanguage}
            options={LANGUAGES.map((l) => ({ value: l.lang, label: l.label }))}
          />
          {/*
            Color mode and density in one menu. Not a Segmented with icons: the icons of a Segmented have no
            accessible name (the `title` of an option ends up on an inner element, not on its radio button)
          */}
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'light', label: t.light, icon: 'sun' },
                { key: 'dark', label: t.dark, icon: 'moon' },
                { key: 'system', label: t.system, icon: 'monitor' },
                { type: 'divider' },
                { key: 'comfortable', label: t.comfortable, icon: 'rows' },
                { key: 'compact', label: t.compact, icon: 'list' },
              ],
              selectedKeys: [props.colorMode, props.density],
              onClick: ({ key }) => {
                const mode = COLOR_MODES.find((m) => m === key)
                if (mode) props.onColorModeChange(mode)
                const density = DENSITIES.find((d) => d === key)
                if (density) props.onDensityChange(density)
              },
            }}
          >
            <IconButton
              icon={MODE_ICONS[props.colorMode]}
              label={`${t.appearance}: ${t[props.colorMode]}, ${t[props.density]}`}
            />
          </Dropdown>
          <Button
            variant="text"
            href={pkg.homepage.replace(/#readme$/, '')}
            target="_blank"
            icon="external-link"
          >
            {t.repository}
          </Button>
        </Inline>
      </Box>
      {body}
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        items={items}
        placeholder={t.searchPlaceholder}
        emptyText={t.searchEmpty}
        label={t.search}
      />
    </div>
  )
}

/** The root of the site: the theme and the preferences around the shell. */
export function SiteRoot() {
  const route = useHashRoute()
  const [colorMode, setColorMode] = useState(() =>
    readSetting<ColorModePreference>('color-mode', COLOR_MODES, 'system'),
  )
  const [density, setDensity] = useState(() =>
    readSetting<Density>('density', DENSITIES, 'comfortable'),
  )
  const changeColorMode = (mode: ColorModePreference) => {
    setColorMode(mode)
    saveSetting('color-mode', mode)
  }
  const changeDensity = (next: Density) => {
    setDensity(next)
    saveSetting('density', next)
  }
  return (
    <ThemeProvider colorMode={colorMode} density={density} locale={languageOf(route.lang).locale}>
      <App>
        <Shell
          route={route}
          colorMode={colorMode}
          onColorModeChange={changeColorMode}
          density={density}
          onDensityChange={changeDensity}
        />
      </App>
    </ThemeProvider>
  )
}
