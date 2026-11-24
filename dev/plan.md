# 优化与重构计划

状态（2026-11-24）：**阶段 1 进行中。** 每完成一个阶段更新本文件。

## 背景

- 维护者要求对整个项目做一次评审，并说明“不用担心历史包袱”：可以接受破坏公开 API 的改动，这类改动集中到 2.0。
- 硬约束不变：AGENTS.md 的视觉方向和动效体系；公开 API 不暴露 antd / rc / dayjs 类型；中英双语文档从 TSDoc 生成；
  必须在 WebKitGTK 上可用。
- 评审分工：Codex 看代码和逻辑（architecture、components、subsystems、tooling），Claude 看样式和页面（styling、visual）。
  原始报告在 [`dev/review/`](review/)，每条发现都有 `path:line` 和证据，下文用报告里的编号引用（如 CC-01）。
- 抽查过的结论（对照源码确认成立）：ARCH-03、CC-01、SUB-05、CC-10、ARCH-01。另外 ARCH-02 / CC-04、ARCH-04 / CC-08
  由两位评审各自独立发现。
- 页面验证（claude-visual）：44 个页面状态在 Chromium 和 WebKitGTK 2.52 下各截一张对比。**WebKitGTK 的渲染与 Chromium
  基本一致**，没有布局错乱、阴影丢失或颜色错误；主要差别是 WebKitGTK 的文字宽约 1–2%，长段落提前换行。
  该代理被中断，报告由主代理根据它留下的截图整理。
- 实施时的分工：逻辑和功能交给 Codex；样式、动效和页面验证交给 Claude。视觉有变化的改动先给维护者看前后截图。

## 基线

2026-11-24 跑了四次 `pnpm check` / `pnpm test`，结论：

- lint（6 个原有警告）、typecheck、node 测试、docs:check、api:check 都通过；**实际运行的测试全部通过**（最好的一次 949/949）。
- 但浏览器项目每次都有一批测试文件加载失败：`Failed to fetch dynamically imported module`，每次失败的文件不同（3–15 个）。
  同样的文件单独运行全部通过；把并发降到 4 个 worker 后失败变少（4 个）但没有消失。
- 不是代码回归：1.7.0 之后只改了文档。也不是 Vite 依赖重新预构建（缓存没有被改写），清掉 vitest 的模块缓存也没用。
- 最可能的原因是机器内存紧张：交换分区 15 GiB 全满，`/tmp` 是内存盘、已用 87%（大部分是其他项目的文件）。未证实。
- 第一次运行和评审代理并行，另有两个 node 测试在 5 秒内没加载完 antd（CT04）。

因此阶段 1 加一项：让浏览器测试在资源紧张时也稳定（见下）。

## 阶段

顺序的理由：先让质量门槛可靠（阶段 1），后面的修复和重构才有安全网；先做不破坏 API 的（阶段 2–4，可以发 1.x），
破坏性的集中进 2.0（阶段 5–6）。

### 阶段 1：测试与 CI 可靠（不破坏，约 1 天）

- [ ] CT01 新增 push / PR 时运行 `pnpm check` 的 workflow（现在只有打 tag 发布时才跑，问题到发布时才暴露）。
- [ ] 浏览器测试文件在完整运行中偶发加载失败（见“基线”）。先在内存充足时确认是否复现；考虑限制浏览器项目的并发、
  把文档测试从同一次运行中拆出去（CT08），或对“加载失败”而不是“断言失败”自动重试一次。
- [ ] CT04 把 antd 的加载移出 5 秒的测试体（`test/guards.test.ts:71`、`test/tokens.test.ts:266`）。
- [ ] CT02 CommandPalette 防抖 / 取消测试改成确定性的（已知 CI 偶发失败）。
- [ ] CT03 charts-motion 去掉 100 ms / 150 ms 的墙钟断言（已知 CI 偶发失败）。
- [ ] CT06 Reasoning 测试去掉真实的 1.6 秒等待，改为控制 `Date.now`。
- [ ] CT07 区分“一帧”和“绘制后”两个帮助函数；性能测试的滚动负载现在只有声称的一半。
- [ ] CT05 发布前用打好的 tarball 做一次使用方冒烟测试（类型检查、打包、懒加载 chunk 都能解析）。
- [ ] CT09 加一个小的 WebKit 测试项目（Drawer、FilePreview、嵌套弹层焦点、虚拟滚动、减少动态效果）。

### 阶段 2：修 bug（不破坏，约 2 天）

- [ ] ARCH-02 / CC-04 Checkbox、Radio、Radio.Button 的 ref 声明是 `HTMLInputElement`，实际给的是 rc 的 handle。
- [ ] CC-01 Select、TreeSelect、Cascader 受控的 `value={null}` 被转成 `undefined`，变成非受控。
- [ ] ARCH-03 共享的懒加载失败后，只有点了重试的那个图表恢复，其他图表一直显示错误（`lazy.ts:69`）。
- [ ] CC-10 消息在 `onClose` 里按同一个 key 重新打开时，新消息会被旧的移除计时器删掉（`messageStore.ts:115`）。
- [ ] CC-03 对话框焦点循环没排除 `visibility: hidden` 的元素，Tab 会卡住（`FocusScope.tsx:31`）。
- [ ] CC-05 Form 合并 ref 时丢掉了 React 19 callback ref 返回的清理函数（`form.tsx:332`）。
- [ ] CC-06 Nav 的项目重新排序后，选中背景停在旧位置（`Nav.tsx:283`）。
- [ ] CC-09 危险确认的输入框没有读屏名称（`feedback.tsx:296`）。
- [ ] SUB-02 SegmentedBar 从 loading 切回来后不再观察标签尺寸（`SegmentedBar.tsx:207`）。
- [ ] SUB-03 FilePreview 换了 `src` 但 `id` 不变时，图片 / 视频 / 音频保留旧的错误状态和尺寸。
- [ ] SUB-04 FilePreview 取消拖动仍会切换文件；滑动中途双指缩放会留下位移和变淡的背景。抽出手势控制器。
- [ ] SUB-05 图表用 `Math.min(...arr)` 求极值，25 万个点会栈溢出（heatmap、scatter、bar）。
- [ ] CT10 文档生成器内联示例时丢了 import 别名，复制的代码编译不过（`scripts/docs.ts:663`）。

### 阶段 3：性能与可访问性（不破坏，约 2 天）

- [ ] CC-02 / SUB-01 VirtualList、MessageList 每次渲染都新建 `getItemKey`，滚动时重算全部条目的尺寸。
- [ ] CC-02 ImageGrid 每次渲染都扫描全部 items 找 caption。
- [ ] SUB-06 MessageList、ImageGrid 虚拟化时，聚焦的元素滚出窗口会被卸载、焦点丢失（DataTable 已经处理了，可以抽共用逻辑）。
- [ ] SUB-09 ToolCalls 折叠状态下每次更新都对结果做完整的 `JSON.stringify`。
- [ ] SUB-10 图片尺寸缓存 `naturalSizes` 无上限，blob URL 会一直累积。
- [ ] SUB-11 DataTable 按状态拆成 `useColumnPreferences`、`useTableSelection`、`useTableViewport`，去掉滚动时的全量扫描。
- [ ] ARCH-06 主题读取放进不依赖 antd / dayjs 的 context 模块，按密度、变量、看图背景拆开，避免无关组件重渲染。
- [ ] CT08 一次 `pnpm check` 里文档只生成、校验一次（现在两次）。

### 阶段 4：样式与动效体系（不破坏 API；视觉有变化的先截图确认，约 3 天）

- [ ] S4 antd 的运行时样式放进 cascade layer（`StyleProvider layer`），去掉约 120 个专门压过 antd 的高优先级选择器和
  多数 `!important`。要在 MIGRATION.md 说明使用方 CSS 的优先级变化。
- [ ] S5 一个 `deriveColors()` 同时供 CSS 变量和 antd 主题使用，修掉已经出现的偏差（深色模式主按钮悬停方向相反、
  链接按下方向相反、错误焦点光环透明度不同、AppShell 遮罩 10% 而 Drawer 遮罩 32%）。统一取值是视觉变化，先截图。
- [ ] S1 / CC-11 / S10 消息进出场改成可中断的 transition（参照 Drawer），离场时长由 CSS 决定，不再在 JS 里写死 140 ms；
  加退出时长令牌。
- [ ] S2 / S6 “减少动态效果”覆盖 antd：Loading（antd Spin）和 PageSkeleton 现在仍在转、仍在闪；合并 8 份 spin 关键帧。
- [ ] S7 AppShell 窄屏抽屉：遮罩关闭时瞬间消失、离场不比进场快。
- [ ] S3 Switch 等依赖 antd 内部 CSS 变量的覆盖：自己维护尺寸，每个剩下的内部依赖加一个会失败的测试。
- [ ] S9 焦点环、光环、状态层、滚动条在约 25 处重复声明，收成共用规则或令牌。
- [ ] S12 零散的字面量（圆角、字重）换成令牌。
- [ ] S14（不确定）AppShell 折叠在动画中改 `grid-template-columns`，WebKitGTK 上可能掉帧，需要实测。
- [ ] S15 `app-region` 拖动区域在 Tauri / WebKitGTK 上无效，Tauri 用 `data-tauri-drag-region`。
- [ ] V2 紧凑密度的 DataTable 在 WebKitGTK 下横向溢出几个像素，表格下出现滚动条。先在两个引擎里比较
  `scrollWidth` 和 `clientWidth`，再找出是哪一列的宽度。
- [ ] V3（不确定）DatePicker 聚焦状态在 WebKitGTK 截图里不同，可能是离屏窗口没有焦点造成的，在真实的 Tauri 应用里确认。

### 阶段 5：2.0 公开 API 清理（破坏性）

- [ ] ARCH-01 API 报告补全私有的 OwnProps 和模式类型（现在改了继承的 props，报告不变）。这一项本身不破坏，先做，
  后面的破坏性改动才能在报告里看出来。
- [ ] ARCH-04 / CC-08 Select 的值类型限定为 `string | number`（对象值现在会丢失），检查 TreeSelect、Cascader。
- [ ] CC-07 InlineEdit 数字模式显式声明（现在清空后再保存会从 number 变成 string）。
- [ ] SUB-07 MessageList 完成播报从数据生成，不依赖已挂载的行（新增 `getAnnouncement`）。
- [ ] SUB-08 ChartContainer 的表格改为按需生成（`getTable`），表格行虚拟化。
- [ ] ARCH-07 Divider、Empty、Timeline、Descriptions 改为自己的原生实现，去掉 `Descriptions.Item`。
- [ ] S8 删除 23 个没有使用的 CSS 变量（多数是和状态层规则矛盾的 `-hover` / `-active` / `-disabled`）。
- [ ] S11 去掉一次性的 `vl-rise` 等进场关键帧，给 “跳到最新” 按钮加退场。
- [ ] S13 只给单个模块用、又不随密度变化的组件令牌（79 个中的 53 个）收回为模块内部变量。

### 阶段 6：依赖瘦身与结构（大，部分破坏性）

- [ ] ARCH-05 App 不再挂载 antd 的 message 和 notification（只有 useConfirmDanger 用到 modal）。
- [ ] ARCH-09 Reasoning、ToolCalls、PromptInput 改为自己的实现，去掉 `@ant-design/x`（它强制安装 mermaid 等）。
- [ ] ARCH-08 图标注册表改为按图标 import，用到任何图标就打包全部 118 个的问题随之消失；名字查找改为可选入口。
- [ ] ARCH-10 拆出 core、charts、AI 入口，ECharts 和 Markdown 渲染器改为可选依赖，样式也按入口拆分。
- [ ] CT12 `scripts/docs.ts`（1960 行）按提取、模型、渲染拆分，补充小型夹具测试。
- [ ] CT11 文档站生成精简的清单并按路由懒加载内容（现在打开任意页面都加载全部约 2.3 MB 源数据）。

## 不要动的部分

评审一致认为这些设计是对的，不要为了统一而重写：ESM 构建和根入口的 tree-shaking；图表与 Markdown 的懒加载模型；
`internal.ts` 的小型适配工具；日期、Form 等复杂的 antd 输入组件；发布流程的权限和产物交接；双语 TSDoc 合同；
弹簧编译器 `spring.ts` 与 `linear()` 降级；Drawer 的动效（其他组件照它改）；只靠组件令牌实现密度；OKLCH 与对比度检查；
`data-vl-state` 状态层；ECharts 实例生命周期；DataTable 的原生表格虚拟化；useStream 的取消与清理；hotkeys 注册表；
useDelayedPending；Upload 的请求管理；SelectionBar 的焦点 / inert 顺序。

## 维护者的决定（2026-11-24）

1. 按阶段 1 → 6 的顺序做。
2. 做 2.0：阶段 5–6 的破坏性改动进入 2.0，要写 MIGRATION.md 和 CHANGELOG。何时发布 1.x / 2.0 由维护者决定。
3. 阶段 4 的 S5（统一颜色）会改变外观，做之前先给维护者看截图。

## 做法

- 每个阶段在临时分支 `stage-<n>` 上做，验收后合并回 `main` 并删除分支。推送、打 tag 要维护者同意。
- 逻辑、测试和工具交给 Codex；样式、动效和页面验证交给 Claude。主代理写任务说明、审查改动、跑验证，然后提交。
- 机器内存紧张时不要同时跑两套测试（见“基线”）。

## 经验

见 [`dev/lessons.md`](lessons.md)。
