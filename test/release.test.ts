import { describe, expect, it } from 'vitest'
import { checkPacked, checkRelease } from '../scripts/release.ts'

const manifest = {
  name: 'vellum-ui',
  version: '1.0.0',
  repository: { url: 'git+https://github.com/bibipala/vellum-ui.git' },
  publishConfig: { registry: 'https://registry.npmjs.org/', access: 'public' },
  main: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    './styles.css': './dist/styles.css',
    './fonts.css': './dist/fonts.css',
    './global.css': './dist/global.css',
  },
}
const files = new Set([
  'dist/index.js',
  'dist/index.d.ts',
  'dist/styles.css',
  'dist/fonts.css',
  'dist/global.css',
  'llms.txt',
  'docs/components.json',
  'docs/en-US/README.md',
  'docs/zh-CN/README.md',
  'examples/Image.examples.tsx',
  'examples/ImageGrid.examples.tsx',
  'examples/Lightbox.examples.tsx',
  'examples/_stream.ts',
  'stories/sample.ts',
  'LICENSE',
])

describe('release gates', () => {
  it('accepts an exact stable tag and the pnpm-packed manifest', () => {
    expect(checkRelease(manifest, 'refs/tags/v1.0.0')).toBe('1.0.0')
    expect(() => checkPacked(manifest, (file) => files.has(file))).not.toThrow()
  })

  it.each([undefined, 'refs/heads/main', 'v1.0.0', 'refs/tags/v1.0.1'])('rejects ref %s', (ref) => {
    expect(() => checkRelease(manifest, ref)).toThrow()
  })

  it.each(['1.0.0-beta.1', '1.0.0+build', '01.0.0'])('rejects non-stable version %s', (version) => {
    expect(() => checkRelease({ ...manifest, version }, `refs/tags/v${version}`)).toThrow()
  })

  it('rejects a private package, a wrong package name or repository, and a different registry', () => {
    for (const changed of [
      { private: true },
      { name: 'other-ui' },
      { repository: { url: 'https://example.com/other' } },
      { publishConfig: { registry: 'https://example.com/', access: 'public' } },
    ])
      expect(() => checkRelease({ ...manifest, ...changed }, 'refs/tags/v1.0.0')).toThrow()
  })

  it('rejects entry points left pointing to source by npm pack', () => {
    expect(() => checkPacked({ ...manifest, main: undefined }, (file) => files.has(file))).toThrow()
    expect(() =>
      checkPacked({ ...manifest, exports: { '.': './src/index.ts' } }, (file) => files.has(file)),
    ).toThrow()
  })

  it('rejects missing build output, documentation or example dependencies', () => {
    for (const missing of [
      'dist/index.js',
      'dist/styles.css',
      'llms.txt',
      'docs/en-US/README.md',
      'examples/_stream.ts',
      'stories/sample.ts',
    ]) {
      expect(() => checkPacked(manifest, (file) => file !== missing && files.has(file))).toThrow(
        missing,
      )
    }
  })

  it('rejects source files, credentials and installed dependencies in a tarball', () => {
    for (const extra of ['src', '.env', '.npmrc', 'node_modules']) {
      expect(() => checkPacked(manifest, (file) => file === extra || files.has(file))).toThrow(
        extra,
      )
    }
  })
})
