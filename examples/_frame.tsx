/** For examples only: a fixed-height container for virtual lists and image grids. In real pages, place them in `Page fill` / `Panel fill`. */
import type { ReactNode } from 'react'
import styles from './_frame.module.css'

export function DemoFrame(props: { children?: ReactNode }) {
  return <div className={styles.frame}>{props.children}</div>
}
