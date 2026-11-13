import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import {
  Alert,
  Avatar,
  Breadcrumb,
  Button,
  CodeBlock,
  CommandPalette,
  type CommandPaletteItem,
  Drawer,
  Icon,
  IconButton,
  Input,
  Kbd,
  LinkButton,
  Markdown,
  Nav,
  type NavGroup,
  Select,
  Tabs,
  Text,
  useHotkeys,
  useMessage,
  useTheme,
} from 'vellum-ui'
import styles from './DocsArticle.module.css'

// —— Data of the recipe: replace with your content source ——

const PRODUCT = 'Halyard'

/** The pages of the documentation, as the left navigation shows them. */
const NAV: readonly NavGroup[] = [
  {
    type: 'group',
    label: 'Get started',
    items: [
      { key: 'introduction', label: 'Introduction' },
      { key: 'quickstart', label: 'Quickstart' },
      { key: 'authentication', label: 'Authentication' },
    ],
  },
  {
    type: 'group',
    label: 'Webhooks',
    items: [
      { key: 'webhooks', label: 'Overview' },
      { key: 'event-types', label: 'Event types' },
      { key: 'verify-signatures', label: 'Verify signatures' },
      { key: 'testing', label: 'Test locally' },
    ],
  },
  {
    type: 'group',
    label: 'Guides',
    items: [
      { key: 'pagination', label: 'Pagination' },
      { key: 'idempotency', label: 'Idempotent requests' },
      { key: 'rate-limits', label: 'Rate limits' },
      { key: 'errors', label: 'Errors' },
    ],
  },
  {
    type: 'group',
    label: 'Reference',
    items: [
      { key: 'api', label: 'API reference' },
      { key: 'sdks', label: 'SDKs' },
      { key: 'changelog', label: 'Changelog' },
    ],
  },
]

const CURRENT = 'verify-signatures'
const PAGES = NAV.flatMap((g) => g.items)
const here = PAGES.findIndex((p) => p.key === CURRENT)
const PREV = PAGES[here - 1]
const NEXT = PAGES[here + 1]

const VERSIONS = [
  { value: '3.2', label: 'v3.2' },
  { value: '3.1', label: 'v3.1' },
  { value: '2.9', label: 'v2.9 (legacy)' },
]
const LATEST = '3.2'

const AUTHORS = ['Maya Okafor', 'Daniel Brandt', 'Priya Raman']

/** The sections of the article, in order: the headings, the table of contents and the palette all read them. */
const SECTIONS = [
  { id: 'why', title: 'Why verify' },
  { id: 'signing', title: 'How signing works' },
  { id: 'verify', title: 'Verify a request' },
  { id: 'replay', title: 'Reject replayed events' },
  { id: 'retries', title: 'Retries and timeouts' },
  { id: 'rotate', title: 'Rotate the secret' },
  { id: 'troubleshooting', title: 'Troubleshooting' },
] as const
type SectionId = (typeof SECTIONS)[number]['id']

type Lang = 'node' | 'python' | 'go'
const LANGS: readonly { readonly key: Lang; readonly label: string; readonly code: string }[] = [
  { key: 'node', label: 'Node.js', code: 'js' },
  { key: 'python', label: 'Python', code: 'python' },
  { key: 'go', label: 'Go', code: 'go' },
]

const HEADER_EXAMPLE =
  'Halyard-Signature: t=1763035200,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd'

const VERIFY: Record<Lang, string> = {
  node: `const crypto = require('node:crypto')

function verify(rawBody, header, secret, toleranceSec = 300) {
  const pairs = header.split(',').map((part) => part.split('='))
  const t = Number(pairs.find(([key]) => key === 't')?.[1])
  const signatures = pairs.filter(([key]) => key === 'v1').map(([, v]) => v)

  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest('hex')

  return signatures.some(
    (s) => s.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)),
  )
}`,
  python: `import hashlib
import hmac
import time

def verify(raw_body: bytes, header: str, secret: str, tolerance: int = 300) -> bool:
    pairs = [part.split("=", 1) for part in header.split(",")]
    t = int(next(v for k, v in pairs if k == "t"))
    signatures = [v for k, v in pairs if k == "v1"]

    if abs(time.time() - t) > tolerance:
        return False

    payload = f"{t}.".encode() + raw_body
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(s, expected) for s in signatures)`,
  go: `func Verify(body []byte, header, secret string, tolerance time.Duration) bool {
    var t int64
    var signatures []string
    for _, part := range strings.Split(header, ",") {
        key, value, _ := strings.Cut(part, "=")
        switch key {
        case "t":
            t, _ = strconv.ParseInt(value, 10, 64)
        case "v1":
            signatures = append(signatures, value)
        }
    }
    if time.Since(time.Unix(t, 0)).Abs() > tolerance {
        return false
    }

    mac := hmac.New(sha256.New, []byte(secret))
    fmt.Fprintf(mac, "%d.%s", t, body)
    expected := hex.EncodeToString(mac.Sum(nil))
    for _, s := range signatures {
        if hmac.Equal([]byte(s), []byte(expected)) {
            return true
        }
    }
    return false
}`,
}

const ROTATE: Record<Lang, string> = {
  node: `const secrets = [process.env.WEBHOOK_SECRET, process.env.WEBHOOK_SECRET_OLD]
const ok = secrets.filter(Boolean).some((secret) => verify(rawBody, header, secret))`,
  python: `secrets = [os.environ["WEBHOOK_SECRET"], os.environ.get("WEBHOOK_SECRET_OLD")]
ok = any(verify(raw_body, header, s) for s in secrets if s)`,
  go: `ok := Verify(body, header, os.Getenv("WEBHOOK_SECRET"), 5*time.Minute) ||
    Verify(body, header, os.Getenv("WEBHOOK_SECRET_OLD"), 5*time.Minute)`,
}

// The prose of each section, as Markdown; callouts and code tabs sit between these blocks
const PROSE = {
  why: `Every webhook ${PRODUCT} sends carries a **signature** in the \`Halyard-Signature\` header. Checking it proves two things: the request really comes from ${PRODUCT}, and nobody changed the body on the way.

Skip the check, and anyone who learns the address of your endpoint can post events to it: a refund that never happened, or a subscription that was never paid.`,
  signing: `${PRODUCT} signs each delivery with HMAC-SHA256 and the **signing secret** of the endpoint, which you find under *Developers → Webhooks*. The header holds a timestamp \`t\` and one or more signatures \`v1\`:`,
  signingSteps: `The signed payload is the timestamp, a period and the **raw** request body, exactly as it arrived:

1. Read \`t\` and every \`v1\` value from the header.
2. Build the string \`{t}.{raw body}\`.
3. Compute its HMAC-SHA256 with your signing secret, as lowercase hex.
4. Compare the result with each \`v1\` value, in constant time.`,
  verify: `Hash the body before your framework parses it. Parsing the JSON and serializing it again changes whitespace and key order, and the signature no longer matches. The examples take the body as bytes or a string, untouched.`,
  replay: `The timestamp is part of the signed payload, so it cannot be changed without breaking the signature. Reject events whose timestamp is more than **five minutes** away from your clock: a recorded request becomes useless shortly after it was sent.

For a stronger guarantee, store the \`id\` of each processed event and ignore duplicates. Retries reuse the same \`id\`, so this also makes your handler safe to run twice.`,
  retries: `Answer with any \`2xx\` status within **10 seconds** to acknowledge a delivery. Anything else, a timeout included, schedules a retry:

| Attempt | Delay after the previous one | Time since the event |
| --- | --- | --- |
| 1 | immediately | 0 |
| 2 | 1 minute | 1 min |
| 3 | 10 minutes | 11 min |
| 4 | 1 hour | 1 h 11 min |
| 5 | 6 hours | 7 h 11 min |
| 6 | 24 hours | 31 h 11 min |

Each retry is signed again with a fresh timestamp, so a late retry never fails the tolerance check. After the sixth failure the event is marked *failed*; resend it by hand from *Developers → Events*.`,
  rotate: `Roll the secret whenever it may have leaked, and at least once a year. Both secrets stay valid during the switch, so no event is lost:

1. Under *Developers → Webhooks*, choose **Roll secret**. The old one keeps working for 24 hours.
2. Deploy your endpoint with both secrets, accepting a signature made with either of them.
3. Once the deployment is out, remove the old secret, or let it expire.`,
  troubleshooting: `- **Every signature fails.** You are probably hashing a parsed body. In Express, mount \`express.raw({ type: 'application/json' })\` on the webhook route.
- **Signatures fail after a deploy.** The endpoint may read the secret of another environment: test and live endpoints have different secrets.
- **Only some events fail.** A proxy in front of your server may rewrite the body, for example its line endings or its encoding.
- **Events arrive late.** Look at \`delivery_attempt\` in the payload: values above 1 mean earlier attempts failed.`,
}

// —— Behavior ——

/**
 * The section in view: the one that crosses a thin band near the top of the scrolling area. A Set keeps every
 * section inside the band (two at a boundary) and the first one in document order wins; when none is (above the
 * first heading), the previous answer stays. Once the area is scrolled to its end, the band can no longer reach
 * the last sections, so the last one wins there. The observer and the listener are removed on unmount.
 */
function useActiveSection(
  scrollerRef: RefObject<HTMLElement | null>,
  idOf: (id: SectionId) => string,
) {
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id)
  useEffect(() => {
    const root = scrollerRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const inBand = new Set<string>()
    let atEnd = false
    const update = () => {
      const first = atEnd
        ? SECTIONS[SECTIONS.length - 1]
        : SECTIONS.find((s) => inBand.has(idOf(s.id)))
      if (first) setActive(first.id)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.add(e.target.id)
          else inBand.delete(e.target.id)
        }
        update()
      },
      // The band: from 15% to 20% of the height of the scrolling area
      { root, rootMargin: '-15% 0px -80% 0px' },
    )
    for (const s of SECTIONS) {
      const el = document.getElementById(idOf(s.id))
      if (el) observer.observe(el)
    }
    const onScroll = () => {
      const end = root.scrollTop + root.clientHeight >= root.scrollHeight - 2
      if (end === atEnd) return
      atEnd = end
      update()
    }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      root.removeEventListener('scroll', onScroll)
    }
  }, [scrollerRef, idOf])
  return [active, setActive] as const
}

type Vote = 'up' | 'down'

/** "Was this page helpful?": a vote, then an optional comment, then a thank-you. */
function Feedback() {
  const questionId = useId()
  const [vote, setVote] = useState<Vote | null>(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // A real site posts the vote and the comment to its feedback endpoint here
  const send = async () => {
    setSending(true)
    await new Promise((resolve) => setTimeout(resolve, 900))
    setSending(false)
    setSent(true)
  }

  if (sent)
    return (
      <div className={styles.feedback} role="status">
        <span className={styles.thanks}>
          <Icon name="check-circle" size={20} tone="success" />
          <Text weight="semibold">Thank you for the feedback.</Text>
        </span>
        <Text size="sm" tone="secondary">
          It goes straight to the people who write these pages.
        </Text>
      </div>
    )

  return (
    <div className={styles.feedback}>
      <div className={styles.voteRow}>
        <Text weight="semibold" id={questionId}>
          Was this page helpful?
        </Text>
        {/* Toggle buttons of our own: aria-pressed tells which one is chosen */}
        <fieldset className={styles.votes} aria-labelledby={questionId}>
          {(['up', 'down'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={styles.vote}
              data-vl-state=""
              aria-pressed={vote === v}
              onClick={() => setVote(v)}
            >
              <Icon name={v === 'up' ? 'thumbs-up' : 'thumbs-down'} size={16} />
              {v === 'up' ? 'Yes' : 'No'}
            </button>
          ))}
        </fieldset>
      </div>
      {vote && (
        <div className={styles.comment}>
          <Input.TextArea
            aria-label="Comment"
            placeholder={
              vote === 'up'
                ? 'What helped you most? (optional)'
                : 'What was missing or unclear? (optional)'
            }
            autoSize={{ minRows: 2, maxRows: 6 }}
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className={styles.commentActions}>
            <Button variant="text" disabled={sending} onClick={() => setSent(true)}>
              Skip
            </Button>
            <Button variant="primary" loading={sending} onClick={send}>
              Send feedback
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// —— The page ——

/**
 * Documentation article
 * An article page of a product's documentation, editorial rather than card-based: a quiet top bar, the navigation,
 * a reading column limited to a comfortable measure in `ch` with a large title and body, and an "On this page"
 * table of contents that follows the reading position. The body is Markdown between callouts (Alert) and code
 * examples in Tabs, whose language choice is shared by every example on the page. The table of contents
 * highlights the section in view with an IntersectionObserver and scrolls to a heading on click; `Mod+K`
 * (useHotkeys) opens a CommandPalette over the pages and the sections; a version Select warns about old versions;
 * a theme toggle uses useTheme; a thin bar under the top bar shows the reading progress with a scroll-driven CSS
 * animation. The article ends with "Was this page helpful?" (a vote, an optional comment, a thank-you) and links
 * to the previous and the next page. On narrow widths the table of contents is hidden and the navigation moves
 * into a Drawer.
 * @zh 文档文章页
 * 产品文档的文章页，偏向排版而不是卡片：安静的顶栏、导航、以 `ch` 限定舒适行长的阅读栏（标题与正文字号都更大），
 * 以及跟随阅读位置的"本页目录"。正文是 Markdown，中间穿插提示（Alert）与放在 Tabs 中的代码示例，页面上所有示例
 * 共用同一个语言选择。本页目录用 IntersectionObserver 高亮当前可见的小节，点击时滚动到对应标题；`Mod+K`
 * （useHotkeys）打开覆盖所有页面与小节的 CommandPalette；版本 Select 在旧版本上给出提醒；主题切换用 useTheme；
 * 顶栏下的细条用滚动驱动的 CSS 动画显示阅读进度。文末是"这页有帮助吗？"（投票、可选的留言、致谢）以及上一页与
 * 下一页的链接。窄屏时隐藏本页目录，导航移入 Drawer。
 * @level scenario
 */
export function DocsArticle() {
  const message = useMessage()
  const { mode, setColorMode } = useTheme()
  const nextMode = mode === 'dark' ? 'light' : 'dark'
  const [version, setVersion] = useState(LATEST)
  const [lang, setLang] = useState<Lang>('node')
  const [searchOpen, setSearchOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)

  // Element ids unique to this instance, so that two articles on one screen do not share their anchors
  const uid = useId()
  const idOf = useCallback((id: SectionId) => `${uid}-${id}`, [uid])
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useActiveSection(scrollerRef, idOf)

  useHotkeys('mod+k', () => setSearchOpen((o) => !o), {
    description: 'Search the documentation',
    allowInInputs: true,
  })

  // Scrolls the article area itself (scrollIntoView would also scroll every container around it). The CSS turns
  // on smooth scrolling unless the user prefers reduced motion
  const scrollTo = (top: number) => scrollerRef.current?.scrollTo({ top })
  const goToSection = (id: SectionId) => {
    const root = scrollerRef.current
    const section = document.getElementById(idOf(id))
    if (!root || !section) return
    setActive(id)
    scrollTo(
      section.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop,
    )
    // The heading takes the focus, so that keyboard and screen reader users continue from there
    section.querySelector('h2')?.focus({ preventScroll: true })
  }

  // A real site navigates with its router here
  const openPage = (key: string) => {
    setNavOpen(false)
    if (key === CURRENT) return scrollTo(0)
    const page = PAGES.find((p) => p.key === key)
    message.info(`"${page?.label ?? key}" opens here, through the router of the site`)
  }

  const commands: CommandPaletteItem[] = [
    ...SECTIONS.map((s) => ({
      id: `section:${s.id}`,
      title: s.title,
      group: 'On this page',
      icon: 'hash' as const,
      onSelect: () => goToSection(s.id),
    })),
    ...NAV.flatMap((g) =>
      g.items.map((p) => ({
        id: `page:${p.key}`,
        title: p.label,
        group: g.label,
        icon: 'file-text' as const,
        keywords: [g.label],
        onSelect: () => openPage(p.key),
      })),
    ),
    {
      id: 'theme',
      title: `Switch to ${nextMode} mode`,
      group: 'Actions',
      icon: nextMode === 'dark' ? 'moon' : 'sun',
      keywords: ['theme', 'appearance'],
      onSelect: () => setColorMode(nextMode),
    },
  ]

  /** The code tabs: every group shows the language chosen last, in any of them. */
  const codeTabs = (code: Record<Lang, string>, label: string) => (
    <div className={styles.example}>
      <Tabs
        activeKey={lang}
        onChange={(key) => setLang(key as Lang)}
        items={LANGS.map((l) => ({
          key: l.key,
          label: l.label,
          children: (
            <CodeBlock
              code={code[l.key]}
              language={l.code}
              copyable
              maxHeight="lg"
              aria-label={`${label}, ${l.label}`}
            />
          ),
        }))}
      />
    </div>
  )

  const section = (id: SectionId, children: ReactNode) => {
    const index = SECTIONS.findIndex((s) => s.id === id)
    const title = SECTIONS[index]?.title
    return (
      <section id={idOf(id)} className={styles.section} aria-labelledby={`${idOf(id)}-h`}>
        <h2 id={`${idOf(id)}-h`} className={styles.heading} tabIndex={-1}>
          <span className={styles.number} aria-hidden>
            {String(index + 1).padStart(2, '0')}
          </span>
          {title}
          <a
            className={styles.anchor}
            href={`#${idOf(id)}`}
            aria-label={`Link to ${title}`}
            onClick={(e) => {
              e.preventDefault()
              goToSection(id)
            }}
          >
            <Icon name="link" size={16} />
          </a>
        </h2>
        {children}
      </section>
    )
  }

  const nav = <Nav aria-label="Documentation" items={NAV} value={CURRENT} onSelect={openPage} />

  return (
    <div className={styles.docs}>
      <header className={styles.topbar}>
        <span className={styles.menuButton}>
          <IconButton icon="sidebar" label="Open navigation" onClick={() => setNavOpen(true)} />
        </span>
        <button
          type="button"
          className={styles.brand}
          data-vl-state=""
          onClick={() => openPage('introduction')}
        >
          <span className={styles.mark}>
            <Icon name="webhook" size={16} />
          </span>
          {PRODUCT}
          <span className={styles.brandDocs}>Docs</span>
        </button>
        <Select
          aria-label="Documentation version"
          size="sm"
          variant="borderless"
          value={version}
          onChange={setVersion}
          options={VERSIONS}
        />
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.search}
          data-vl-state=""
          onClick={() => setSearchOpen(true)}
        >
          <Icon name="search" size={16} />
          <span className={styles.searchLabel}>Search the docs</span>
          <Kbd keys="mod+k" />
        </button>
        <IconButton
          icon={nextMode === 'dark' ? 'moon' : 'sun'}
          label={`Switch to ${nextMode} mode`}
          onClick={() => setColorMode(nextMode)}
        />
        {/* Reading progress: a scroll-driven animation in the CSS, no script */}
        <span className={styles.progress} aria-hidden />
      </header>

      <div className={styles.body} ref={scrollerRef}>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>{nav}</aside>

          <main className={styles.article}>
            <header className={styles.articleHeader}>
              <Breadcrumb
                items={[
                  { title: 'Docs', onClick: () => openPage('introduction') },
                  { title: 'Webhooks', onClick: () => openPage('webhooks') },
                  { title: 'Verify signatures' },
                ]}
              />
              <h1 className={styles.title}>Verify webhook signatures</h1>
              <p className={styles.lede}>
                Make sure that every event your endpoint receives was sent by {PRODUCT} and arrived
                unchanged, and turn away old events that someone recorded and plays back.
              </p>
              <div className={styles.meta}>
                <span className={styles.authors}>
                  {AUTHORS.map((name) => (
                    <span key={name} className={styles.author}>
                      <Avatar name={name} size={24} />
                    </span>
                  ))}
                </span>
                <Text size="sm" tone="secondary">
                  {AUTHORS[0]} and {AUTHORS.length - 1} others
                </Text>
                <span className={styles.dot} aria-hidden />
                <Text size="sm" tone="secondary" as="time" dateTime="2026-11-04">
                  Updated Nov 4, 2026
                </Text>
                <span className={styles.dot} aria-hidden />
                <Text size="sm" tone="secondary">
                  7 min read
                </Text>
              </div>
            </header>

            {version !== LATEST && (
              <Alert
                tone="warning"
                showIcon
                title={`You are reading the documentation of v${version}`}
                description={
                  <>
                    Signatures work the same way, but the SDK calls differ.{' '}
                    <LinkButton onClick={() => setVersion(LATEST)}>Switch to v{LATEST}</LinkButton>
                  </>
                }
              />
            )}

            {section(
              'why',
              <>
                <div className={styles.prose}>
                  <Markdown content={PROSE.why} />
                </div>
                <Alert
                  showIcon
                  title="The SDKs verify for you"
                  description="From version 4.2, the official libraries do all of this in one call, webhooks.constructEvent(). Read on to see what it checks, or if you use another language."
                />
              </>,
            )}
            {section(
              'signing',
              <>
                <div className={styles.prose}>
                  <Markdown content={PROSE.signing} />
                </div>
                <CodeBlock
                  code={HEADER_EXAMPLE}
                  language="http"
                  wrap
                  aria-label="Signature header"
                />
                <div className={styles.prose}>
                  <Markdown content={PROSE.signingSteps} />
                </div>
              </>,
            )}
            {section(
              'verify',
              <>
                <div className={styles.prose}>
                  <Markdown content={PROSE.verify} />
                </div>
                {codeTabs(VERIFY, 'Verify a signature')}
              </>,
            )}
            {section(
              'replay',
              <>
                <div className={styles.prose}>
                  <Markdown content={PROSE.replay} />
                </div>
                <Alert
                  tone="warning"
                  showIcon
                  title="Keep your server clock in sync"
                  description="A clock that drifts by more than the tolerance rejects every event. Run NTP on your servers, or widen the tolerance while you investigate."
                />
              </>,
            )}
            {section(
              'retries',
              <div className={styles.prose}>
                <Markdown content={PROSE.retries} />
              </div>,
            )}
            {section(
              'rotate',
              <>
                <div className={styles.prose}>
                  <Markdown content={PROSE.rotate} />
                </div>
                {codeTabs(ROTATE, 'Accept two secrets')}
              </>,
            )}
            {section(
              'troubleshooting',
              <div className={styles.prose}>
                <Markdown content={PROSE.troubleshooting} />
              </div>,
            )}

            <footer className={styles.articleFooter}>
              <Feedback />
              <nav className={styles.pager} aria-label="Previous and next page">
                {[PREV, NEXT].map(
                  (page, i) =>
                    page && (
                      <button
                        key={page.key}
                        type="button"
                        className={styles.pagerLink}
                        data-vl-state=""
                        data-direction={i === 0 ? 'prev' : 'next'}
                        onClick={() => openPage(page.key)}
                      >
                        <span className={styles.pagerHint}>
                          {i === 0 && <Icon name="arrow-left" size={14} />}
                          {i === 0 ? 'Previous' : 'Next'}
                          {i === 1 && <Icon name="arrow-right" size={14} />}
                        </span>
                        <span className={styles.pagerTitle}>{page.label}</span>
                      </button>
                    ),
                )}
              </nav>
            </footer>
          </main>

          <aside className={styles.toc} aria-labelledby={`${uid}-toc`}>
            <Text overline id={`${uid}-toc`}>
              On this page
            </Text>
            <ol className={styles.tocList}>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    className={styles.tocLink}
                    href={`#${idOf(s.id)}`}
                    aria-current={active === s.id ? 'location' : undefined}
                    onClick={(e) => {
                      e.preventDefault()
                      goToSection(s.id)
                    }}
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
            <div className={styles.tocActions}>
              <LinkButton icon="arrow-up" onClick={() => scrollTo(0)}>
                Back to top
              </LinkButton>
              <LinkButton
                icon="edit"
                onClick={() => message.info('The editor of the page opens here')}
              >
                Edit this page
              </LinkButton>
            </div>
          </aside>
        </div>
      </div>

      <Drawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title={`${PRODUCT} Docs`}
        width={320}
      >
        {nav}
      </Drawer>
      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        items={commands}
        placeholder="Search pages and sections"
      />
    </div>
  )
}
