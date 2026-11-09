/** Release gates shared by the source checkout and the tarball inspection in CI. No dependencies or credentials. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

interface ReleaseManifest {
  name: string
  version: string
  private?: boolean
  repository?: { url?: string }
  main?: string
  types?: string
  exports?: Record<string, unknown>
  publishConfig?: { registry?: string; access?: string }
}

/** Only stable, exactly matching version tags publish to npm's latest channel. */
export function checkRelease(manifest: ReleaseManifest, ref: string | undefined): string {
  assert.equal(manifest.name, 'vellum-ui', 'Unexpected package name')
  assert.notEqual(manifest.private, true, 'The package is still private')
  assert.match(
    manifest.version,
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    'Expected a stable version',
  )
  assert.equal(ref, `refs/tags/v${manifest.version}`, 'Tag must match package.json version exactly')
  assert.equal(manifest.repository?.url, 'git+https://github.com/bibipala/vellum-ui.git')
  assert.equal(manifest.publishConfig?.registry, 'https://registry.npmjs.org/')
  assert.equal(manifest.publishConfig?.access, 'public')
  return manifest.version
}

/** Reject npm-packed source entries and incomplete tarballs before any credentials are made available. */
export function checkPacked(manifest: ReleaseManifest, hasFile: (file: string) => boolean): void {
  assert.equal(manifest.main, './dist/index.js', 'Pack with pnpm so publishConfig is applied')
  assert.equal(manifest.types, './dist/index.d.ts')
  assert.deepEqual(manifest.exports?.['.'], {
    types: './dist/index.d.ts',
    default: './dist/index.js',
  })
  for (const style of ['styles', 'fonts', 'global']) {
    assert.equal(manifest.exports?.[`./${style}.css`], `./dist/${style}.css`)
  }
  for (const file of [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/styles.css',
    'dist/fonts.css',
    'dist/global.css',
    'llms.txt',
    'docs/components.json',
    'docs/en-US/README.md',
    'docs/zh-CN/README.md',
    'LICENSE',
  ])
    assert(hasFile(file), `Missing packed file: ${file}`)
  for (const file of ['src', '.env', '.npmrc', 'node_modules']) {
    assert(!hasFile(file), `Unexpected packed path: ${file}`)
  }
}

if (import.meta.main) {
  const packedRoot = process.argv[2]
  const root = packedRoot ?? fileURLToPath(new URL('..', import.meta.url))
  const manifest = JSON.parse(
    readFileSync(path.join(root, 'package.json'), 'utf8'),
  ) as ReleaseManifest
  const version = checkRelease(manifest, process.env.GITHUB_REF)
  if (packedRoot) checkPacked(manifest, (file) => existsSync(path.join(root, file)))
  console.log(version)
}
