# 经验

开发中踩过的坑和验证过的做法。新的经验追加在对应小节下。

## 测试与检查

- **不要和其他 vite / vitest 进程并行跑 `pnpm check`。** 2026-11-24 和多个评审代理同时运行时，浏览器项目报
  “getByRole is not supported by the playwright provider”、`expect.element is not a function`，以及 iframe 60 秒内没就绪；
  两个 node 测试在 5 秒内没加载完 antd。都是环境问题，不是代码回归。确认基线时让机器空闲。
- 浏览器测试报 `Failed to fetch dynamically imported module`、而且每次失败的文件不同时，先单独运行这些文件。
  单独能过只能说明与运行条件有关，不能直接归因于内存。先看 `free -h`、`df -h /tmp`，再用
  `VITEST_PW_DEBUG=1` 抓失败请求，并检查 Vite 的 HTTP 响应。
- **2026-11-24 的模块加载失败已确认是 `ERR_NETWORK_CHANGED`。** 201 条失败请求全是同一错误；Vite 对失败资源返回
  200，`ip -ts monitor address` 则每约 10 秒记录 eth0 的 IPv6 地址 DAD 失败后被删除（这台是 VMware 虚拟机，
  多半是同一网段有相同 MAC 的克隆机）。Chromium 把地址变化当成网络切换，中断所有进行中的请求。
- **在这台机器上跑测试用只有回环的网络命名空间**，Chromium 看不到 eth0 的变化：
  `unshare -rn sh -c 'ip link set lo up && pnpm check'`。2026-11-24 在其中用默认并发连跑两次，没有任何导入失败，
  浏览器项目约 85 秒。根治要修主机网络。
- 问题在主机就不要在仓库里绕过：曾把同源模块请求改由 Node 转发、并把浏览器测试改成单 worker，能通过，
  但所有环境都要背这层复杂度，测试也慢了约 4 倍，还掩盖了负载下的时序问题，已撤回。
- debounce 测试不能假设两次 `userEvent.fill` 落在同一个 150ms 窗口里（实测每条命令超过 450ms）；精确计时要用
  原生输入事件 + `act` + 假时钟，取消和过期响应要用尚未完成的 deferred Promise。
- 单帧采样用一个 rAF，绘制后稳定用两个 rAF；性能滚动每次必须只等一帧。长任务观察器停止时先 `takeRecords()`，
  再 `disconnect()`，调用方用 `finally` 清理。
- 校正性能测试负载后要保留暴露出来的预算失败：2026-11-24 DataTable 的滚动 / 大跨度跳转记录到 62–70ms 长任务，
  没有扩大原有 50ms 预算；Chat 和 Markdown 同次运行没有长任务。
- 测动效的中间状态和中途打断，不要按墙钟采样：用 `element.getAnimations()` 找到真实的 `CSSTransition` /
  `CSSAnimation`，`pause()` 后设置 `currentTime` 定位，再触发关闭并比较离场起点。要在触发交互之前先拿到过渡。
- 对话框“可见”早于它最后一次自动聚焦；测焦点要等进场结束、焦点落定，否则会和自动聚焦抢。
- 提示（Tooltip）会挡住同一按钮打开的菜单：测试里点菜单前先移开指针、等提示关闭。
- 整机换页严重时（交换分区满），Playwright 的单次点击可能卡在“等待导航”上超时；这不是测试逻辑的问题，空闲后复跑。
- CHANGELOG 只记使用方能感知的变化，测试和内部工具的改动不记（历史版本一直如此）。
- 已知只在 CI 偶发失败的测试：`charts-motion`（墙钟断言）、CommandPalette 的异步 `onSearch`（防抖窗口竞争）。
  原因和修法见 `dev/review/codex-tooling.md` 的 CT02、CT03。
- 这台机器上没有 `gh` 和 token。查 CI 结果用公开 API：
  `curl https://api.github.com/repos/bibipala/vellum-ui/actions/runs`，失败详情用 `check-runs/<job>/annotations`。

## 组件实现

- **effect 不要依赖使用方传入的数组或对象的身份**：使用方常写 `items={[...]}`，身份每次渲染都变。2026-11-25 Nav 的滑块
  因依赖 `items` 身份，选中项变化时被紧接着“直接就位”，滑动被打断。改为依赖结构键（key、顺序、文字拼成的字符串）。
  测试里要同时覆盖“同一个数组”和“每次新的数组字面量”。

- 统计序列化次数用 `toJSON` 计数，不要用 getter：React 19 开发版在性能轨道里比较变化的 props 时会读 getter，
  计数会多出来。
- 性能测试的结果受整机负载影响很大：同一个 DataTable 预算，负载高时出现 62–70 ms 长任务，空闲时没有。
  判断性能回归前先在空闲机器上复测。

- 行为不变的重构，用“新旧代码渲染同一批状态，比较 `innerHTML` 是否逐字节相同”来验证，比只跑测试更可靠
  （2026-11-25 DataTable 拆分：12 种状态全部一致）。
- 子代理因限流（429）中途停止时，用 SendMessage 让同一个子代理继续，它保留上下文，工作区里的改动也还在。

- **样式改动用截图对比验收**：`pnpm site:build` 后 `pnpm visual:shoot <dir>`，改完再拍一次，`pnpm visual:diff <a> <b>`。
  它同时比较计算样式和强制悬停 / 按下 / 聚焦后的状态，能发现截图看不出的差异。都要在只有回环的网络命名空间里跑。
- 把 antd 放进 cascade layer 后，antd 全局注入的标签规则（如 `a:hover`）不再压过本库的规则，链接的交互状态无法逐像素
  保持；本库自己的零优先级默认样式要放进排在 antd 之前的 `vellum-defaults` 层，否则反而会压过 antd 组件。

- 新测试要先确认它能失败：2026-11-26 一个“深色模式”测试传了不存在的 `{ mode }`，其实一直在测浅色；测试渲染的颜色模式
  选项是 `colorMode`（`render(ui, { colorMode: 'dark' })`）。去掉修复后跑一次，确认测试真的会失败。

- 按名称查找的注册表无法被 tree-shake：只要组件能同步地把名称解析成图标，它的导入图就包含整个注册表。懒加载能省体积，
  但所有按名称的图标首帧会空白、服务端输出也是空的；对桌面应用不划算（2026-11-26 否决）。

- 可选 peer 依赖：核心入口的导入图（包括懒加载的 chunk）里不能出现它们，否则使用方没装时打包就失败；Vite 会报
  `__vite-optional-peer-dep:<包名>:vellum-ui`。`scripts/build.ts` 在构建时检查这一点。
- 多入口发布时，所有入口要通过相对路径共用同一份 React context 模块（preserve modules 构建天然如此），
  `pnpm test:package` 会检查每个 context 只创建一次。
- 在 `/tmp`（内存盘）里离线安装 tarball 测体积：`pnpm install --offline --store-dir <本机 store> --package-import-method copy`。

- 暂停真实过渡做测试时，组件可能随后取消那条过渡，`animation.ready` 会以 AbortError（"The user aborted a request."）
  拒绝；负载高时偶发。`pauseTransition` 已忽略这种拒绝。断言前最好确认要测的过渡没有变成 `idle`，否则测试可能
  什么也没验证（media-image 的受控关闭就是这样，待修）。

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

- **驱动 WebKitGTK 用 `dev/tools/webkitgtk-probe.py`**（在只有回环的命名空间里 `xvfb-run -a python3 -I …`）。要用显示出来的
  `Gtk.Window`，不要用 `Gtk.OffscreenWindow`：离屏窗口永远没有焦点，`:focus` / `:focus-visible` 不匹配，聚焦样式看起来不对
  （V3 就是这个误报）。`call_async_javascript_function` 能等 Promise；`UserScript` 相当于 `addInitScript`。
- 这台虚拟机没有 3D，WebKitGTK 用软件绘制，重绘一次主区域 25–40 ms；布局开销约为 Chromium 的 5 倍（与 GPU 无关）。
  判断动效卡顿时分开测：强制同步布局、只改绘制属性、只改 transform。避免动画期间每帧改变布局（如 `grid-template-columns`）。
- 比较布局宽度要用有界面的 Chromium（`headless: false` + xvfb）：无头 Chromium 隐藏滚动条、不给页面滚动条留宽度，
  布局比 WebKitGTK 宽约 10 px。

- **CI 里的失败先拿到证据，再改库代码。** 2026-11-27 WebKit CI 报 FilePreview 打开后宽 191.99 px，我误判为“较新 WebKit 读错
  SVG 原始尺寸”，推送了修复，失败值却完全不变，只好撤回。实际上 191.99 × 120 是飞行起点时按缩略图缩放的图片框
  （`getBoundingClientRect` 包含 transform，不含裁剪）：测试在动画结束前就量了宽度。正确做法是先让测试等真实终态，并在失败
  信息里带上 transform、加载状态等诊断；本机跑不了的引擎（Playwright WebKit）尤其如此。

- **发布时先确认 `main` 推送成功，再推送 tag。** 2026-11-27 发布 2.0.0 时，`main` 因为主机 DNS 抖动没推上去，tag 却推上去了：
  发布流程在“main ancestry”检查失败（没有发布到 npm）。按 AGENTS.md 先用 `npm view vellum-ui@2.0.0` 确认没发布，推上 `main`，
  再删除远端 tag、在同一提交上重新推送，重跑成功。网络抖动时的重试循环要判断 `git push` 自己的退出码，不要用 `| tail` 之后的
  退出码或 `ls-remote` 的结果来判断：`ls-remote` 本身失败时会被误当成“tag 已删除”。这台机器没有 `gh`，查 Actions 用公开的
  REST API（`curl` 加 `json.loads(..., strict=False)`，提交信息里有控制字符）。

## 排查使用方报告的问题

- 使用方报告的界面问题先看使用方的用法。例如抽屉“没有关闭动画”，原因是使用方条件挂载（`{show && <Drawer open />}`），
  不是库的问题。
