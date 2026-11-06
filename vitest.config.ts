import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { configDefaults, defineConfig } from 'vitest/config'

// vitest 5 默认把 fsModuleCache 放在工作区根目录，多个包并行测试时会互相清空而启动失败；每个包用自己的目录
const fsModuleCachePath = fileURLToPath(new URL('node_modules/.vitest-cache', import.meta.url))

/**
 * 浏览器测试用的 Chromium：用系统安装的浏览器，不下载 Playwright 自带的浏览器。
 * 路径由环境变量 CHROMIUM_PATH 指定；Linux 下默认 /usr/bin/chromium，其他平台必须设置
 * （如 Windows 上 Chrome 或 Edge 的 exe 路径），否则 Playwright 会去找它自己下载的浏览器而启动失败。
 */
const chromiumPath =
  process.env.CHROMIUM_PATH || (process.platform === 'linux' ? '/usr/bin/chromium' : undefined)

/** 浏览器中运行的测试项目（交互测试与 vitest.perf.config.ts 的性能预算共用的设置）。 */
export const browserProject = {
  extends: true,
  // antd 在 NODE_ENV=test 时把所有内部 id 固定为 test-id：不同单选组的 name 相同、互相串组，
  // aria 关联也失效。浏览器测试要的是与真实应用一致的行为，按开发环境构建
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  // 预构建 ECharts 与 Ant Design X 的各个入口：否则在没有缓存的检出（新机器、CI）上，Vite 要等测试运行到图表时才发现它们，
  // 重新预构建并刷新页面，正在加载的测试 iframe 超时而失败（2026-11-06 合并 M3 时出现）
  optimizeDeps: {
    include: [
      'echarts/core',
      'echarts/charts',
      'echarts/components',
      'echarts/renderers',
      // Ant Design X 只按组件目录引入（如 '@ant-design/x/es/sender'），不引入总入口：总入口会带上 mermaid 等
      // 很大的依赖，预构建要花几秒
      '@ant-design/x-markdown/es/index.js',
      '@ant-design/x/es/think/index.js',
      '@ant-design/x/es/thought-chain/index.js',
      '@ant-design/x/es/sender/index.js',
    ],
  },
  test: {
    fsModuleCachePath,
    // 处理全部 CSS（含 CSS Modules）：状态层、焦点环、过渡都是真实效果
    css: true,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({
        launchOptions: { executablePath: chromiumPath },
      }),
      instances: [{ browser: 'chromium' as const }],
      viewport: { width: 1280, height: 800 },
      // 失败截图默认写到测试文件旁的 __screenshots__，不需要这些文件
      screenshotFailures: false,
    },
  },
}

export default defineConfig({
  cacheDir: 'node_modules/.vite',
  test: {
    fsModuleCachePath,
    projects: [
      {
        // 不访问 DOM 的测试：令牌、守卫、文档、服务端渲染的结构、状态机
        extends: true,
        test: {
          name: 'node',
          fsModuleCachePath,
          include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
          exclude: [...configDefaults.exclude, 'test/browser/**'],
        },
      },
      {
        // 真实浏览器中的交互测试：悬停、键盘、焦点、弹层进出、动效（docs/11 §6.2）
        ...browserProject,
        test: {
          ...browserProject.test,
          name: 'browser',
          include: ['test/browser/**/*.browser.test.tsx'],
          // 性能预算由 vitest.perf.config.ts 单独运行（`pnpm test:perf`）
          exclude: [...configDefaults.exclude, 'test/browser/perf/**'],
        },
      },
    ],
  },
})
