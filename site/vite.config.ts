/**
 * The documentation site (Vite): `pnpm site:dev` on http://127.0.0.1:3621, `pnpm site:build` into `site/dist/`,
 * `pnpm site:preview` serves the build on http://127.0.0.1:3622.
 *
 * `base: './'`: every URL is relative, so the same build works at the root of a domain and under a path such as
 * `https://<user>.github.io/vellum-ui/`. The routes are in the hash, which needs no server configuration.
 */
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { staticFiles } from './static-files.ts'

const siteDir = fileURLToPath(new URL('.', import.meta.url))
const pkgRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: siteDir,
  base: './',
  cacheDir: fileURLToPath(new URL('../node_modules/.vite-site', import.meta.url)),
  plugins: [react(), staticFiles(pkgRoot)],
  // Pre-bundle the chart engine and the Markdown renderer, which the pages load on demand: otherwise the dev server
  // discovers them only when such a page opens, bundles them and reloads the page
  optimizeDeps: {
    include: [
      'echarts/core',
      'echarts/charts',
      'echarts/components',
      'echarts/renderers',
      '@ant-design/x-markdown/es/index.js',
      '@ant-design/x/es/think/index.js',
      '@ant-design/x/es/thought-chain/index.js',
      '@ant-design/x/es/sender/index.js',
    ],
  },
  server: {
    host: '127.0.0.1',
    port: 3621,
    strictPort: true,
    // The site reads the sources, examples and documentation of the package outside its own folder
    fs: { allow: [pkgRoot] },
  },
  preview: { host: '127.0.0.1', port: 3622, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The site bundles the whole library with Ant Design and all the documentation data; the examples, charts and
    // the Markdown renderer are separate chunks loaded on demand
    chunkSizeWarningLimit: 4096,
  },
})
