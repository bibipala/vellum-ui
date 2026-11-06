/**
 * 性能预算（挂钟时间：长任务、帧间隔），由 `pnpm test:perf` 运行，不在 `pnpm test` 中。
 *
 * 挂钟时间只有在没有其他测试同时占用 CPU 时才可靠：与全部测试一起并行运行时，同一段代码会测出 58ms 的长任务
 * （2026-11-06 合并 M4b 时出现）。所以单独运行，并且逐个文件运行。验收（ADR 0020 §4）时运行，改动流式渲染、
 * 消息列表等对性能敏感的代码后也要运行。
 */
import { defineConfig } from 'vitest/config'
import { browserProject } from './vitest.config.ts'

export default defineConfig({
  cacheDir: 'node_modules/.vite',
  test: {
    projects: [
      {
        ...browserProject,
        test: {
          ...browserProject.test,
          name: 'perf',
          include: ['test/browser/perf/**/*.browser.test.tsx'],
          fileParallelism: false,
        },
      },
    ],
  },
})
