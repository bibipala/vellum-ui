/**
 * For examples only: a simulated streaming endpoint, so that the examples run without a server. It returns a
 * `Response` whose body is a Server-Sent Events stream, the same shape a real `fetch` returns. Real pages call
 * `fetch` instead.
 */

export interface FakeStreamOptions {
  /** Aborts the stream, like the `signal` of `fetch`. */
  readonly signal?: AbortSignal
  /** Characters per event. */
  readonly chunk?: number
  /** Milliseconds between events. */
  readonly interval?: number
  /** Fails with this error after this many characters. */
  readonly failAfter?: number
}

/** The default reply of the examples: a short Markdown answer. */
export const DEMO_REPLY = `Here is a short plan for the launch:

1. **Freeze the scope** on Monday and share the list with the team.
2. Run the release checklist; anything \`blocked\` moves to the next sprint.
3. Write the announcement — keep it under 200 words.

> Ship small, ship often.

Let me know if you want a timeline as a table.`

/**
 * Streams `text` as Server-Sent Events: `data: {"delta":"…"}` every `interval` milliseconds, then `data: [DONE]`.
 */
export function fakeSSE(text: string, options: FakeStreamOptions = {}): Response {
  const { chunk = 3, interval = 30, signal, failAfter } = options
  if (signal?.aborted) throw signal.reason
  const encoder = new TextEncoder()
  let timer: ReturnType<typeof setTimeout> | undefined
  let sent = 0
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const next = () => {
        if (failAfter !== undefined && sent >= failAfter) {
          controller.error(new Error('The connection was reset'))
          return
        }
        if (sent >= text.length) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }
        const delta = text.slice(sent, sent + chunk)
        sent += delta.length
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`))
        timer = setTimeout(next, interval)
      }
      timer = setTimeout(next, interval)
    },
    cancel() {
      clearTimeout(timer)
    },
  })
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}
