/**
 * Entry of the documentation site. The library is imported from its sources like the examples do (`vellum-ui`
 * resolves to `src/index.ts` through the `exports` of the package), with the stylesheets a page built entirely with
 * vellum-ui imports.
 */
import 'vellum-ui/styles.css'
import 'vellum-ui/fonts.css'
import 'vellum-ui/global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SiteRoot } from './Site.tsx'

const container = document.getElementById('root')
if (!container) throw new Error('The page has no #root element')
createRoot(container).render(
  <StrictMode>
    <SiteRoot />
  </StrictMode>,
)
