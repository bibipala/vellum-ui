import {
  Button,
  Inline,
  Markdown,
  readSSE,
  type ServerSentEvent,
  Stack,
  useStream,
} from 'vellum-ui'
import { DEMO_REPLY, fakeSSE } from './_stream.ts'

// Every event carries {"delta": "..."}; the last one is [DONE]
const appendDelta = (text: string, e: ServerSentEvent) =>
  e.data === '[DONE]' ? text : text + (JSON.parse(e.data) as { delta: string }).delta

const RICH = `## Release checklist

The build passed on all three platforms. Before tagging:

- [x] Update the \`CHANGELOG\`
- [x] Run the end-to-end tests
- [ ] Ask **Maya** to review the migration notes

| Step | Owner | Time |
| --- | --- | ---: |
| Freeze | Alex | 10 min |
| Tag and publish | Sam | 25 min |

\`\`\`ts
export const version = '2.4.0'
\`\`\`

> Docs are at [the project site](https://example.com/docs), see the [contributing guide](/docs/contributing).

---

Ping the team when the tag is live.`

/**
 * Basic usage
 * Pass the Markdown text. Headings, lists, task lists, tables, quotes, inline code and code blocks follow the theme;
 * code blocks show their language and a copy button.
 * @zh 基本用法
 * 传入 Markdown 文本。标题、列表、任务列表、表格、引用、行内代码、代码块都跟随主题；代码块显示语言与复制按钮。
 */
export function Basic() {
  return <Markdown content={RICH} />
}

/**
 * Streaming reply
 * While the reply streams in, set `streaming`: half-written syntax is shown as if finished, and a cursor marks the
 * end. `typewriter` smooths out chunks that arrive in bursts.
 * @zh 流式回复
 * 回复流式到达时设置 `streaming`：写到一半的语法按写完显示，结尾有光标。`typewriter` 让成块到达的内容匀速放出。
 * @section States
 */
export function Streaming() {
  const reply = useStream({
    request: (signal) =>
      readSSE(fakeSSE(DEMO_REPLY, { signal, chunk: 4, interval: 40 }), { signal }),
    initial: '',
    reduce: appendDelta,
  })
  const streaming = reply.status === 'streaming'
  return (
    <Stack gap={3}>
      <Inline gap={2}>
        {streaming ? (
          <Button onClick={reply.stop}>Stop</Button>
        ) : (
          <Button type="primary" onClick={() => reply.start()}>
            Generate
          </Button>
        )}
      </Inline>
      <Markdown content={reply.value} streaming={streaming} typewriter />
    </Stack>
  )
}

const UNTRUSTED = `Raw HTML is shown as text: <img src="x" onerror="alert(1)"> <script>alert(1)</script>

Only safe links work: [docs](https://example.com/docs), [mail](mailto:team@example.com), [bad](javascript:alert(1)).

![Chart of last week](https://images.example.com/chart.png)

![Team logo](https://assets.example.com/logo.png)`

/**
 * Untrusted content
 * Raw HTML is always shown as text, and links with other protocols such as `javascript:` are plain text. Images are
 * not loaded by default; `allowImage` decides by address (here only the `assets.example.com` host).
 * @zh 不可信的内容
 * 原始 HTML 一律显示为文字，`javascript:` 等其他协议的链接是纯文字。图片默认不加载；`allowImage` 按地址决定
 * （这里只允许 `assets.example.com`）。
 * @section Advanced
 */
export function Untrusted() {
  return (
    <Markdown
      content={UNTRUSTED}
      allowImage={(src) => new URL(src, 'https://app.example.com').host === 'assets.example.com'}
    />
  )
}
