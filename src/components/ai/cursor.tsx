/**
 * 流式内容结尾的光标（StreamingText、Markdown 共用）：对读屏隐藏，流结束时由使用它的组件移除。
 * 组件库内部使用，不从入口导出。
 */
import styles from './cursor.module.css'

export function StreamCursor() {
  return <span className={styles.cursor} aria-hidden data-stream-cursor="" />
}
