/**
 * Publishes files of the package with the site, at the same relative paths as in the package, so that the links of
 * `llms.txt` (`docs/en-US/components/Button.md`) and of the pages (README.md, MIGRATION.md, components.json) work on
 * the site: copied into the build output, and served from the package by the dev server.
 *
 * Node only (used by site/vite.config.ts). Plain `node:fs` calls, no shell commands, so it works on every platform.
 */
import { copyFileSync, cpSync, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { isStaticFile, STATIC_DIRS, STATIC_FILES } from './routes.ts'

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '': 'text/plain; charset=utf-8',
}

/** Copies the published files of the package (`pkgRoot`) into `outDir`. */
export function copyStaticFiles(pkgRoot: string, outDir: string): void {
  for (const file of STATIC_FILES) {
    const target = path.join(outDir, file)
    mkdirSync(path.dirname(target), { recursive: true })
    copyFileSync(path.join(pkgRoot, file), target)
  }
  for (const dir of STATIC_DIRS)
    cpSync(path.join(pkgRoot, dir), path.join(outDir, dir), { recursive: true })
}

/**
 * The package file a request asks for, or null. Only the published files, after resolving `.` and `..`, and only
 * inside the package.
 */
function requestedFile(pkgRoot: string, url: string): string | null {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname)
  } catch {
    return null
  }
  const rel = path.posix.normalize(pathname).replace(/^\/+/, '')
  if (rel.startsWith('..') || !isStaticFile(rel)) return null
  const abs = path.resolve(pkgRoot, ...rel.split('/'))
  const inside = path.relative(pkgRoot, abs)
  if (inside.startsWith('..') || path.isAbsolute(inside)) return null
  return existsSync(abs) && statSync(abs).isFile() ? abs : null
}

/** Vite plugin: serves the published files during development and copies them into the build output. */
export function staticFiles(pkgRoot: string): Plugin {
  let outDir = ''
  return {
    name: 'vellum-docs-static-files',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file =
          req.method === 'GET' || req.method === 'HEAD'
            ? requestedFile(pkgRoot, req.url ?? '/')
            : null
        if (!file) return next()
        res.setHeader(
          'Content-Type',
          CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream',
        )
        if (req.method === 'HEAD') return res.end()
        createReadStream(file).pipe(res)
      })
    },
    writeBundle() {
      copyStaticFiles(pkgRoot, outDir)
    },
  }
}
