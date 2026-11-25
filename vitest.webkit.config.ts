import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'
import { browserProject } from './vitest.config.ts'

export default defineConfig({
  cacheDir: 'node_modules/.vite',
  test: {
    // Vitest 的 testNamePattern 是全局选项，所以与性能项目一样使用独立配置。
    // 只复用这 8 个用例：Drawer 进出与中断、FilePreview 飞入飞回与焦点、嵌套焦点、虚拟滚动、减少动态效果。
    testNamePattern:
      /关闭时滑出窗口|关闭到一半又打开|打开到一半就关闭：从当前位置滑出|「减少动态效果」时立即打开、立即关闭，没有残留的遮罩|第一帧在缩略图的位置|打开时焦点在「关闭」上|嵌套气泡递归归属于当前对话框|1 万行：只渲染可见附近的行/,
    projects: [
      {
        ...browserProject,
        test: {
          ...browserProject.test,
          name: 'webkit',
          // Playwright WebKit 不等同于 Tauri 的 WebKitGTK 2.52，但能发现大多数引擎差异。
          // 所选文件及公共工具不使用 Chromium 专有的 CDP。
          include: [
            'test/browser/dialogs.browser.test.tsx',
            'test/browser/file-preview.browser.test.tsx',
            'test/browser/data-table-virtual.browser.test.tsx',
          ],
          browser: {
            ...browserProject.test.browser,
            // 独立 provider，不能继承 Chromium 的 executablePath。
            provider: playwright(),
            instances: [{ browser: 'webkit' }],
          },
        },
      },
    ],
  },
})
