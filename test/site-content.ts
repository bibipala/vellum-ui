/**
 * The content of the documentation site for the tests in Node, downloaded the way the site downloads it
 * (site/content.ts): every Markdown page through its loader, and the data of every component page in English. The
 * site itself only bundles the manifest and downloads the rest per route.
 */
import {
  componentDocLoader,
  components as manifestComponents,
  markdownLoaders,
} from '../site/content.ts'

export {
  apiPages,
  exampleLoaders,
  guidePages,
  recipeLoaders,
  recipePages,
} from '../site/content.ts'

/** Every Markdown page the site renders: package path → text. */
export const markdownFiles: ReadonlyMap<string, string> = new Map(
  await Promise.all(
    [...markdownLoaders].map(async ([file, load]) => [file, await load()] as const),
  ),
)

/** The data of every component page of the manifest, in English (with its name). */
export const components = await Promise.all(
  manifestComponents.map(async (c) => {
    const load = componentDocLoader('en', c.name)
    if (!load) throw new Error(`No data for the page of ${c.name}`)
    return await load()
  }),
)
