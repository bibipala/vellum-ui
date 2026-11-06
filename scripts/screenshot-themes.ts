/**
 * 主题截图：用已构建的 Storybook（storybook-static）给「主题总览」在浅色、深色下截图，
 * 输出到本包的 docs/assets/themes/。浏览器路径通过环境变量 CHROMIUM_PATH 配置（跨平台，不写死路径）。
 *
 * 用法：pnpm storybook:build && CHROMIUM_PATH=/usr/bin/chromium pnpm screenshots
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const pkgRoot = fileURLToPath(new URL('..', import.meta.url))
const staticDir = resolve(pkgRoot, 'storybook-static')
const outDir = resolve(pkgRoot, 'docs/assets/themes')
const port = Number(process.env.STORYBOOK_PORT ?? 3620)
const modes = ['light', 'dark'] as const

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

if (!existsSync(staticDir))
  throw new Error('storybook-static 不存在，请先运行 pnpm storybook:build')

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  const file = normalize(join(staticDir, urlPath === '/' ? 'index.html' : urlPath))
  // 根目录约束：不允许 .. 逃逸出 storybook-static
  if (!file.startsWith(staticDir + sep) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end()
    return
  }
  res.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
})
await new Promise<void>((r) => server.listen(port, '127.0.0.1', r))

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  mkdirSync(outDir, { recursive: true })
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  for (const mode of modes) {
    const id = encodeURIComponent('overview-theme-overview--theme-overview')
    await page.goto(
      `http://127.0.0.1:${port}/iframe.html?id=${id}&viewMode=story&globals=mode:${mode}`,
      { waitUntil: 'networkidle' },
    )
    await page.waitForFunction((m) => document.documentElement.dataset.vlMode === m, mode)
    await page.waitForTimeout(400)
    const path = join(outDir, `${mode}.png`)
    await page.screenshot({ path, fullPage: true })
    console.log(`已保存 ${path}`)
  }
} finally {
  await browser.close()
  server.close()
}
