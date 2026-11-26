# 优化与重构计划

状态（2026-11-25）：**阶段 1–3 已完成并合并；阶段 4 进行中（A、B、C 已完成）。** 每完成一个阶段更新本文件。

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
- 当时怀疑机器内存紧张（交换分区全满、`/tmp` 内存盘 87%）。后来确认导入失败是主机网络造成的：eth0 的 IPv6
  地址每约 10 秒 DAD 失败被删除，Chromium 报 `ERR_NETWORK_CHANGED`。内存紧张只会让少数时序敏感的测试超时。
- 第一次运行和评审代理并行，另有两个 node 测试在 5 秒内没加载完 antd（CT04）。

因此阶段 1 加了两项：查明导入失败、让时序敏感的测试在负载下也稳定（见下）。

## 阶段

顺序的理由：先让质量门槛可靠（阶段 1），后面的修复和重构才有安全网；先做不破坏 API 的（阶段 2–4，可以发 1.x），
破坏性的集中进 2.0（阶段 5–6）。

### 阶段 1：测试与 CI 可靠（不破坏，约 1 天）

- [x] CT01 新增 `.github/workflows/ci.yml`：PR 和推送到 main 时运行 `pnpm check`、包冒烟测试和 WebKit 测试。**待推送后在 GitHub 上确认能跑通。**
- [x] 浏览器完整运行导入失败：确认是主机 IPv6 地址变化引发 `ERR_NETWORK_CHANGED`，不是仓库的问题。
  本机用只有回环的网络命名空间跑测试（见 lessons）。仓库里只保留 `pnpm test` 分成 node、browser 两步。
  一度加入的 Node 转发模块请求和单 worker 已撤回（慢约 4 倍，还掩盖时序问题）。
  过程和证据见 [`dev/review/stage-1-reliability.md`](review/stage-1-reliability.md)。
- [x] 负载下偶发失败的测试改成按真实终态等待：boundary 的文件扫描移到 `beforeAll`；弹层和对话框等进场焦点落定；
  文档站外观菜单先移开指针等提示关闭。15 个动效测试改为暂停真实的 CSS 过渡并用 `currentTime` 定位，不再按墙钟采样。
  验证：只有回环的网络命名空间里完整 `pnpm check` 通过（Codex 两次中一次因整机换页卡住 Playwright 点击，主代理复跑通过）。
- [x] CT04 把 antd 的加载移出 5 秒的测试体（`test/guards.test.ts`、`test/tokens.test.ts`）。
- [x] CT02 CommandPalette 防抖 / 取消测试改成确定性的：原生事件与假时钟、deferred 请求、过期响应、关闭和卸载。
- [x] CT03 charts-motion 去掉墙钟阈值与 MutationObserver，检查实时选项、目标图例和渲染完成状态。
- [x] CT06 Reasoning 控制 `Date.now` 并在 finally 恢复；Form 按展开状态等待，不再额外睡眠。
- [x] CT07 合并单帧、绘制后、多帧与采样工具，性能滚动恢复每帧 120px；长任务观察器合并并在 finally 排空、断开。
  DataTable 的既有 50ms 预算在校正后的负载下失败，保留预算并报告实测值，不在本阶段改生产代码。
- [x] CT05 `pnpm test:package <tgz>`（`scripts/package-smoke.ts`）：CI 和发布流程都对打好的 tarball 做使用方冒烟测试。
  它发现并修复了一个真实问题：声明文件引用了没有发布的 `base.css`（已记入 CHANGELOG）。
- [x] CT09 `pnpm test:webkit`（`vitest.webkit.config.ts`，8 个现有测试）。本机 Kali 缺 Ubuntu 的库，Playwright WebKit 启动不了，
  **只能在 CI 上验证**。

### 阶段 2：修 bug（不破坏，约 2 天）

已完成（2026-11-25）：每个修复都有在旧代码上失败的回归测试；node 438、browser 598 个测试通过，API 报告不变。
Nav 的修复审查时发现依赖 `items` 数组身份会打断选中滑动，已改为依赖结构。提示遮挡菜单是库的问题：
Dropdown / Popover 打开时，同一触发元素上的提示保持隐藏。

- [x] ARCH-02 / CC-04 Checkbox、Radio、Radio.Button 的 ref 声明是 `HTMLInputElement`，实际给的是 rc 的 handle。
- [x] CC-01 Select、TreeSelect、Cascader 受控的 `value={null}` 被转成 `undefined`，变成非受控。
- [x] ARCH-03 共享的懒加载失败后，只有点了重试的那个图表恢复，其他图表一直显示错误（`lazy.ts:69`）。
- [x] CC-10 消息在 `onClose` 里按同一个 key 重新打开时，新消息会被旧的移除计时器删掉（`messageStore.ts:115`）。
- [x] CC-03 对话框焦点循环没排除 `visibility: hidden` 的元素，Tab 会卡住（`FocusScope.tsx:31`）。
- [x] CC-05 Form 合并 ref 时丢掉了 React 19 callback ref 返回的清理函数（`form.tsx:332`）。
- [x] CC-06 Nav 的项目重新排序后，选中背景停在旧位置（`Nav.tsx:283`）。
- [x] CC-09 危险确认的输入框没有读屏名称（`feedback.tsx:296`）。
- [x] SUB-02 SegmentedBar 从 loading 切回来后不再观察标签尺寸（`SegmentedBar.tsx:207`）。
- [x] SUB-03 FilePreview 换了 `src` 但 `id` 不变时，图片 / 视频 / 音频保留旧的错误状态和尺寸。
- [x] SUB-04 FilePreview 取消拖动仍会切换文件；滑动中途双指缩放会留下位移和变淡的背景。抽出手势控制器。
- [x] SUB-05 图表用 `Math.min(...arr)` 求极值，25 万个点会栈溢出（heatmap、scatter、bar）。
- [x] 新发现（阶段 1）：文档站外观按钮的提示在菜单打开后仍显示，挡住菜单项，点击会落在提示上。先查是站点的用法
  还是库里 Tooltip 与 Dropdown 挂在同一个触发元素上的通病（菜单打开时提示应当关闭）。
- [x] CT10 文档生成器内联示例时丢了 import 别名，复制的代码编译不过（`scripts/docs.ts:663`）。

### 阶段 3：性能与可访问性（不破坏，约 2 天）

已完成（2026-11-25）：node + docs 442、browser 608 个测试通过，API 报告不变；`pnpm check` 41.8 s → 35.7 s。

- [x] CC-02 / SUB-01 VirtualList、MessageList 每次渲染都新建 `getItemKey`，滚动时重算全部条目的尺寸。
- [x] CC-02 ImageGrid 每次渲染都扫描全部 items 找 caption。
- [x] SUB-06 MessageList、ImageGrid 虚拟化时，聚焦的元素滚出窗口会被卸载、焦点丢失（DataTable 已经处理了，可以抽共用逻辑）。
- [x] SUB-09 ToolCalls 折叠状态下每次更新都对结果做完整的 `JSON.stringify`。
- [x] SUB-10 图片尺寸缓存 `naturalSizes` 无上限，blob URL 会一直累积。
- [x] SUB-11 DataTable 按状态拆成 `useColumnPreferences`、`useTableSelection`、`useTableViewport`，去掉滚动时的全量扫描。
  验收：`pnpm test:perf` 的 DataTable 预算通过。（阶段 1 时 Codex 报告 62–70 ms 长任务，2026-11-25 在空闲机器的隔离网络里
  复测没有长任务，预算本来就通过；那次多半是机器负载造成的。拆分后仍要保持通过。）
- [x] ARCH-06 主题读取放进不依赖 antd / dayjs 的 context 模块，按密度、变量、看图背景拆开，避免无关组件重渲染。
- [x] CT08 一次 `pnpm check` 里文档只生成、校验一次（现在两次）。

### 阶段 4：样式与动效体系（不破坏 API；视觉有变化的先截图确认，约 3 天）

- [x] S4 antd 的运行时样式放进 cascade layer（`StyleProvider layer`），去掉约 120 个专门压过 antd 的高优先级选择器和
  多数 `!important`。要在 MIGRATION.md 说明使用方 CSS 的优先级变化。
- [x] S5 一个 `deriveColors()` 同时供 CSS 变量和 antd 主题使用，修掉已经出现的偏差（深色模式主按钮悬停方向相反、
  链接按下方向相反、错误焦点光环透明度不同、AppShell 遮罩 10% 而 Drawer 遮罩 32%）。统一取值是视觉变化，先截图。
- [x] S1 / CC-11 / S10 消息进出场改成可中断的 transition（参照 Drawer），离场时长由 CSS 决定，不再在 JS 里写死 140 ms；
  加退出时长令牌。
- [x] S2 / S6 “减少动态效果”覆盖 antd：Loading（antd Spin）和 PageSkeleton 现在仍在转、仍在闪；合并 8 份 spin 关键帧。
- [x] S7 AppShell 窄屏抽屉：遮罩关闭时瞬间消失、离场不比进场快。
- [x] S3 Switch 等依赖 antd 内部 CSS 变量的覆盖：自己维护尺寸，每个剩下的内部依赖加一个会失败的测试。
- [x] S9 焦点环、光环、状态层、滚动条在约 25 处重复声明，收成共用规则或令牌。
- [x] S12 零散的字面量（圆角、字重）换成令牌。
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
- [ ] （阶段 3 留下）DataTable 的 `isRowSelectable` 若是内联函数，父组件每次渲染都要对全部行重新判断；内联 `columns`
  在有排序时每次重新排序。要消除需要改契约（如约定判断函数只依赖行数据、`columns` 按结构比较），2.0 时评估。
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
   - 待确认（阶段 4A）：antd 放进 cascade layer 后，链接的悬停、按下、聚焦状态有细微变化：Markdown 链接悬停时
     保留下划线、文档站翻页卡片悬停底色变为中性灰（原来是 antd 的淡蓝）。静止状态完全不变。对比图在
     `dev/review/stage-4/`，每一项都能用一条规则恢复原样。
   - 待确认（阶段 4B，均为保持原值的保守选择）：Sources 折叠按钮的状态层颜色沿用 text-primary；三个退出时长令牌
     （120 / 140 / 200 ms）是为了不改任何现有时长，可合并；Pill 和 ImageGrid 说明文字的字重 560 没有对应令牌。
   - 待确认（阶段 4C）：是否统一已经偏离的派生颜色（深色模式主按钮悬停 / 按下方向、链接按下方向、状态光环透明度、
     AppShell 窄屏遮罩改用 `--vl-color-mask`）。补丁 `dev/review/stage-4/unify-derived-colors.patch`，说明和对比图见
     `dev/review/stage-4/unify-derived-colors.md`。
4. （2026-11-25）中途不推送。阶段 1–6 全部完成、2.0 准备好之后再推送。

## 做法

- 每个阶段在临时分支 `stage-<n>` 上做，验收后合并回 `main` 并删除分支。推送、打 tag 要维护者同意。
- 实现交给 Claude 子代理；主代理写任务说明、审查改动、跑验证，然后提交。（阶段 1、2 曾用 Codex，2026-11-25 起不再用：
  结果会丢失、会话会中断、没有完成通知，返工也不少。）
- 机器内存紧张时不要同时跑两套测试（见“基线”）。

## 经验

见 [`dev/lessons.md`](lessons.md)。
