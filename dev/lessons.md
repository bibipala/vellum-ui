# 经验

开发中踩过的坑和验证过的做法。新的经验追加在对应小节下。

## 测试与检查

- **不要和其他 vite / vitest 进程并行跑 `pnpm check`。** 2026-11-24 和多个评审代理同时运行时，浏览器项目报
  “getByRole is not supported by the playwright provider”、`expect.element is not a function`，以及 iframe 60 秒内没就绪；
  两个 node 测试在 5 秒内没加载完 antd。都是环境问题，不是代码回归。确认基线时让机器空闲。
- 浏览器测试报 `Failed to fetch dynamically imported module`、而且每次失败的文件不同时，先单独运行这些文件。
  单独能过就是环境问题（2026-11-24：交换分区全满、内存盘 `/tmp` 87%），不是代码回归。先看 `free -h` 和 `df -h /tmp`。
- 已知只在 CI 偶发失败的测试：`charts-motion`（墙钟断言）、CommandPalette 的异步 `onSearch`（防抖窗口竞争）。
  原因和修法见 `dev/review/codex-tooling.md` 的 CT02、CT03。
- 这台机器上没有 `gh` 和 token。查 CI 结果用公开 API：
  `curl https://api.github.com/repos/bibipala/vellum-ui/actions/runs`，失败详情用 `check-runs/<job>/annotations`。

## 浏览器与 WebKitGTK

- 主要使用方在 Linux 上用 WebKitGTK 渲染。本机的 WebKitGTK（2.52）可以通过 PyGObject 驱动：
  `gi.require_version('WebKit2', '4.1')`，在 `xvfb-run -a python3 -I script.py` 下加载页面并截图，用来和 Chromium 对比。
- 关闭后台的开发服务器时按 PID 结束进程，不要用 `pkill -f` / `pgrep -f`：模式会匹配到执行命令的 shell 自己。
- **无头 Chromium 默认隐藏滚动条**，和 WebKitGTK 对比截图时看不出 Chromium 是否也溢出。比较溢出要量
  `scrollWidth` 和 `clientWidth`，或者用有界面的 Chromium。
- WebKitGTK 的文字比 Chromium 宽约 1–2%（2026-11-24 对比 44 个页面），长段落会提前换行。列宽、按钮宽度不要按
  Chromium 下刚好放得下来定。
- 截图对比先按像素差异给所有组排序，只看差异最大的几组，比逐张查看省得多。
- Playwright 的 `addInitScript` 也会在 `about:blank` 上执行，在那里读写 `localStorage` 会报 SecurityError，
  这是测试脚本的问题，不是页面的。

## 排查使用方报告的问题

- 使用方报告的界面问题先看使用方的用法。例如抽屉“没有关闭动画”，原因是使用方条件挂载（`{show && <Drawer open />}`），
  不是库的问题。
