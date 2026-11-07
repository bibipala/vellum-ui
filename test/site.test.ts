/**
 * The documentation site (site/): its routes cover every page of the generated and hand-written documentation, the
 * links of the pages are rewritten to routes or to files the site publishes, and Markdown is prepared the same way
 * for every page. The browser behavior is in test/browser/site.browser.test.tsx.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  apiPages,
  components,
  exampleLoaders,
  guidePages,
  markdownFiles,
  recipeLoaders,
  recipePages,
} from '../site/content.ts'
import {
  docFileOf,
  headingsOf,
  hrefOf,
  isStaticFile,
  LANGUAGES,
  pageOfPath,
  parseHash,
  prepareMarkdown,
  REPOSITORY_URL,
  rewriteLinks,
  routeOfDocFile,
  type SitePage,
  STATIC_DIRS,
  STATIC_FILES,
  slugify,
} from '../site/routes.ts'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))

/** Markdown files under a folder of the package, as package paths with `/`. */
function markdownUnder(dir: string): string[] {
  const abs = path.join(pkgRoot, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs).flatMap((name) => {
    const rel = `${dir}/${name}`
    if (statSync(path.join(pkgRoot, rel)).isDirectory()) return markdownUnder(rel)
    return name.endsWith('.md') ? [rel] : []
  })
}

const docFiles = LANGUAGES.flatMap((l) => markdownUnder(`docs/${l.dir}`))

describe('documentation site: routes', () => {
  it('every Markdown page of docs/<language>/ has a route, and the route leads back to the file', () => {
    expect(docFiles.length).toBeGreaterThan(100)
    const unrouted = docFiles.filter((f) => routeOfDocFile(f) === null)
    expect(unrouted).toEqual([])
    for (const f of docFiles) {
      const route = routeOfDocFile(f)
      if (!route) continue
      expect(docFileOf(route.lang, route.page), f).toBe(f)
      // The hash of the route parses back to the same page
      expect(parseHash(hrefOf({ ...route, anchor: null })), f).toEqual({ ...route, anchor: null })
    }
  })

  it('the site bundles every Markdown page it renders (all but the component pages, which come from components.json)', () => {
    const rendered = docFiles.filter((f) => routeOfDocFile(f)?.page.kind !== 'component')
    expect([...markdownFiles.keys()].sort()).toEqual(rendered.sort())
  })

  it('every component page has its data, and every component with examples has its examples module', () => {
    for (const f of docFiles) {
      const route = routeOfDocFile(f)
      if (route?.page.kind !== 'component') continue
      const { name } = route.page
      const doc = components.find((c) => c.name === name)
      expect(doc, f).toBeDefined()
      if (doc?.examples.length) expect(exampleLoaders.has(name), name).toBe(true)
    }
  })

  it('guides, recipes and API pages are found by file name, in both languages', () => {
    const routesIn = (folder: string) =>
      docFiles
        .filter((f) => f.startsWith(`docs/en-US/${folder}/`))
        .map((f) => hrefOf({ lang: 'en', page: pageOf(f) }))
        .sort()
    const routesOf = (pages: readonly { page: SitePage }[]) =>
      pages.map((p) => hrefOf({ lang: 'en', page: p.page })).sort()
    expect(routesOf(guidePages)).toEqual(routesIn('guides'))
    expect(routesOf(recipePages)).toEqual(routesIn('recipes'))
    expect(routesOf(apiPages)).toEqual(routesIn('api'))
    expect(apiPages.length).toBeGreaterThan(0)
    for (const p of [...guidePages, ...recipePages, ...apiPages]) {
      expect(p.title.en, JSON.stringify(p.page)).not.toBe('')
      expect(p.title.zh, JSON.stringify(p.page)).not.toBe('')
    }
    for (const r of recipePages)
      if (r.page.kind === 'recipe') expect(recipeLoaders.has(r.page.name), r.page.name).toBe(true)
  })

  it('parses hashes with a language, a page and an anchor', () => {
    expect(parseHash('#/en')).toEqual({ lang: 'en', page: { kind: 'home' }, anchor: null })
    expect(parseHash('#/zh/')).toEqual({ lang: 'zh', page: { kind: 'home' }, anchor: null })
    expect(parseHash('#/en/components/Select')).toEqual({
      lang: 'en',
      page: { kind: 'component', name: 'Select' },
      anchor: null,
    })
    expect(parseHash('#/zh/api/theme#extendtheme')).toEqual({
      lang: 'zh',
      page: { kind: 'api', slug: 'theme' },
      anchor: 'extendtheme',
    })
    expect(parseHash('#/en/tokens')?.page).toEqual({ kind: 'tokens' })
    expect(parseHash('#/en/nothing/here/at-all')?.page).toEqual({
      kind: 'missing',
      path: 'nothing/here/at-all',
    })
    // Without a language the site redirects
    expect(parseHash('')).toBeNull()
    expect(parseHash('#/components/Select')).toBeNull()
    expect(pageOfPath('components/Select')).toEqual({ kind: 'component', name: 'Select' })
    expect(hrefOf({ lang: 'en', page: { kind: 'home' } })).toBe('#/en')
    expect(
      hrefOf({ lang: 'zh', page: { kind: 'guide', slug: 'conventions' }, anchor: 'modes' }),
    ).toBe('#/zh/guides/conventions#modes')
  })

  it('anchors are the slugs of headings, as GitHub writes them', () => {
    expect(slugify('If you know Ant Design')).toBe('if-you-know-ant-design')
    expect(slugify('extendTheme')).toBe('extendtheme')
    expect(slugify('CSS_VAR_PREFIX')).toBe('css_var_prefix')
    expect(slugify('页面配方')).toBe('页面配方')
  })
})

/** The page of a package file that is known to be a page. */
function pageOf(file: string): SitePage {
  const r = routeOfDocFile(file)
  if (!r) throw new Error(file)
  return r.page
}

describe('documentation site: Markdown', () => {
  it('drops the generated header and the language switch, and takes the first heading as the title', () => {
    const md = [
      '<!-- Generated by scripts/docs.ts, do not edit. -->',
      '',
      '**English** | [简体中文](../../zh-CN/api/theme.md)',
      '',
      '# Theme',
      '',
      'The root component.',
    ].join('\n')
    expect(prepareMarkdown(md, 'docs/en-US/api/theme.md')).toEqual({
      title: 'Theme',
      body: 'The root component.',
    })
    // Hand-written guides have the switch without the header
    const guide = '[English](../../en-US/guides/a.md) | **简体中文**\n\n# 指南\n\n正文'
    expect(prepareMarkdown(guide, 'docs/zh-CN/guides/a.md')).toEqual({
      title: '指南',
      body: '正文',
    })
  })

  it('rewrites links to pages, anchors, published files and other files of the package', () => {
    const from = 'docs/en-US/guides/building-pages.md'
    const rewrite = (target: string) => rewriteLinks(`[x](${target})`, from)
    expect(rewrite('../components/Select.md')).toBe('[x](#/en/components/Select)')
    expect(rewrite('conventions.md#if-you-know-ant-design')).toBe(
      '[x](#/en/guides/conventions#if-you-know-ant-design)',
    )
    expect(rewrite('#states')).toBe('[x](#/en/guides/building-pages#states)')
    expect(rewrite('../README.md')).toBe('[x](#/en)')
    expect(rewrite('../tokens.md')).toBe('[x](#/en/tokens)')
    expect(rewrite('../../zh-CN/api/theme.md')).toBe('[x](#/zh/api/theme)')
    expect(rewrite('../../../MIGRATION.md')).toBe('[x](MIGRATION.md)')
    expect(rewrite('../../../README.md#usage')).toBe('[x](README.md#usage)')
    expect(rewrite('../../../llms.txt')).toBe('[x](llms.txt)')
    expect(rewrite('../../components.json')).toBe('[x](docs/components.json)')
    expect(rewrite('../../../CONTRIBUTING.md')).toBe(
      `[x](${REPOSITORY_URL}/blob/main/CONTRIBUTING.md)`,
    )
    expect(rewrite('https://ant.design/')).toBe('[x](https://ant.design/)')
    expect(rewrite('mailto:team@example.com')).toBe('[x](mailto:team@example.com)')
    expect(rewriteLinks('[a](../components/Box.md "Box")', from)).toBe(
      '[a](#/en/components/Box "Box")',
    )
  })

  it('leaves links inside code alone', () => {
    const from = 'docs/en-US/components/Markdown.md'
    const md = [
      'See [Box](Box.md) and `[inline](Box.md)` and ``[two `ticks`](Box.md)``.',
      '```tsx',
      "const text = '[docs](/docs/contributing) [box](Box.md)'",
      '```',
      '~~~',
      '[still code](Box.md)',
      '~~~',
      'After [Stack](Stack.md).',
    ].join('\n')
    expect(rewriteLinks(md, from).split('\n')).toEqual([
      'See [Box](#/en/components/Box) and `[inline](Box.md)` and ``[two `ticks`](Box.md)``.',
      '```tsx',
      "const text = '[docs](/docs/contributing) [box](Box.md)'",
      '```',
      '~~~',
      '[still code](Box.md)',
      '~~~',
      'After [Stack](#/en/components/Stack).',
    ])
  })

  it('every relative link of the rendered pages becomes a route, a published file or a link to the repository', () => {
    const problems: string[] = []
    for (const [file, text] of markdownFiles) {
      const { body } = prepareMarkdown(text, file)
      const prose = body.replace(/```[\s\S]*?```/g, '')
      for (const m of prose.matchAll(/\]\(([^)\s]+)/g)) {
        const target = m[1] as string
        if (/^(?:https?|mailto):/.test(target)) continue
        if (target.startsWith('#/')) {
          const route = parseHash(target)
          if (!route || route.page.kind === 'missing') problems.push(`${file} → ${target}`)
          continue
        }
        const pathPart = target.split('#')[0] ?? ''
        if (!isStaticFile(pathPart)) problems.push(`${file} → ${target}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('lists the headings of a page outside code blocks (the exports of the API reference)', () => {
    expect(headingsOf('## a\n\n```md\n## not a heading\n```\n\n## `b`\n### c')).toEqual(['a', 'b'])
    const theme = apiPages.find((p) => p.page.kind === 'api' && p.page.slug === 'theme')
    expect(theme?.headings.en).toContain('extendTheme')
    expect(theme?.headings.zh).toContain('extendTheme')
  })

  it('publishes the entry for agents and the files it links to', () => {
    for (const f of STATIC_FILES) expect(existsSync(path.join(pkgRoot, f)), f).toBe(true)
    for (const d of STATIC_DIRS) expect(existsSync(path.join(pkgRoot, d)), d).toBe(true)
    expect(isStaticFile('llms.txt')).toBe(true)
    expect(isStaticFile('docs/en-US/components/Button.md')).toBe(true)
    expect(isStaticFile('package.json')).toBe(false)
    expect(isStaticFile('src/index.ts')).toBe(false)
  })
})
