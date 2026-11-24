# AGENTS.md

在本仓库工作的 AI 代理（Codex、Claude 等）必须遵守的约束。文档、公开 API 和发布的细则以
[CONTRIBUTING.md](CONTRIBUTING.md) 为准，这里只列硬性规则和容易做错的地方。

- **修改本文件前先征得维护者同意。**
- 实现和某条约束冲突时，先停下来问维护者是否修改这条约束。不要绕过它，也不要悄悄违反。
- 新会话开始或上下文被压缩后，先重读本文件和 `dev/plan.md`（如果存在）。

## 项目

- React 19 组件库，部分组件基于 antd 6 实现，图表用 ECharts。TypeScript + CSS Modules。
- 设计令牌在 `src/tokens/`，分原始 / 语义 / 组件三层，由 `src/theme/compile.ts` 编译成 `--vl-*` CSS 变量。
- Node 24+，pnpm 版本以 `package.json` 的 `packageManager` 为准。
- 主要使用方是 Tauri 2 桌面应用，在 Linux 上由 **WebKitGTK** 渲染，不是 Chromium。用到较新的 CSS / JS
  特性时确认 WebKitGTK 支持，或者提供降级。只依赖 Chromium 的效果不要做。
- 使用方报告的界面问题，先确认是不是使用方的用法造成的（比如抽屉被条件挂载所以没有关闭动画），再决定是否改库。

## 分支与提交

- 只长期维护 `main`。一个阶段可以开临时分支，验收后合并回 `main`，并删除这个分支（本地和远端）。
- 完成一个阶段就提交。提交信息用英文 Conventional Commits：`feat:`、`fix:`、`fix(recipes):`、`chore(release):` 等。
- 未发布的改动记在 `CHANGELOG.md` 的 `## [Unreleased]` 下（Keep a Changelog 格式）。
- push、打 tag、发布只在维护者要求时做。
- 现有实现明显过于繁琐、有更清晰的设计时，可以重构，重构单独作为一个阶段提交。会破坏公开 API 的改动先问维护者。

## 发布

- 推送 `v<version>` tag 会触发 `.github/workflows/release.yml` 发布到 npm，**发布后不能撤回**。
- 流程：更新 `package.json` 版本和 `CHANGELOG.md` → `pnpm check` → 提交 `chore(release): X.Y.Z` →
  `git tag -a vX.Y.Z -m "Release X.Y.Z"` → 推送 `main` 和 tag。tag 必须和 `package.json` 的版本一致，并且在 `main` 上。
- 不要在源码目录直接 `npm publish`，那样入口会是错的。完整步骤见 CONTRIBUTING.md 的 Releases。
- CI 只是偶发失败时，先确认 npm 上没有发布这个版本，然后删除并重新推送同一个 tag 重跑。
- 1.0.0 起严格遵循语义化版本：破坏公开 API 只能出现在新的主版本，要在 `MIGRATION.md` 写迁移说明。
  废弃的 API 至少保留一个次版本。版本号由维护者决定。

## 质量门槛

- 阶段完成、提交前跑 `pnpm check`（lint、typecheck、test、docs:check、api:check）。中途可以只跑相关测试。
- 浏览器测试默认用 `/usr/bin/chromium`，可以用 `CHROMIUM_PATH` 指定。
- 公开 API 有意变更后运行 `pnpm api:update`，更新 `etc/vellum-ui.api.md`。
- 公开类型不得引用 antd、`@ant-design/*`、`rc-*`、`@rc-component/*` 或 dayjs 的类型。props 的命名规则
  （`size`、`tone`、`variant`、`status`、`open` / `onOpenChange`、ISO 日期字符串等）见 CONTRIBUTING.md。

## 文档

- 文档从 TSDoc 和 `examples/` 生成（`pnpm docs:gen`）。`docs/**`、`docs/components.json`、`llms.txt` 和
  `stories/generated/` 都是生成文件，**不要手改**。只有 `docs/<语言>/guides/` 是手写的。
- 中英文一起更新：英文写在 TSDoc 正文，中文写在 `@zh`、`@usageZh`、`@deprecatedZh`。术语用 CONTRIBUTING.md 的术语表。
- 每个导出都要有 `@category`（组件、hook）或 `@group`（其他导出）。
- 示例数据用英文的中性内容（项目名、人名、文件名），不用真实业务数据。示例里的注释用英文。

## 视觉方向

要的是精致、现代、有艺术感、交互友好的界面。不要“后台管理 / 小工具”式的朴素外观，也不要炫技特效。

- 卡片**不加描边**：没有发丝线或外框，只用柔和、宽而很淡的阴影（`--vl-shadow-near`）和画布区分。
  对比度不够时调阴影或画布，不要加描边。
- 浅色画布是明亮中性的近白色（`--vl-color-bg-canvas`，neutral 25）。中性色不带蓝调，也不用暖色纸张调。
- 输入框、选择器、日期选择等是无边框的填充式输入（`--vl-color-fill-field` 加内阴影 `--vl-shadow-field`）。
  描边样式只作为可选项。
- 控件不做小：舒适密度下 `md` 高 36px。精致感来自细节（凸起的实心按钮、凹陷的输入框），不是缩小尺寸。
- 轨道里的小选中项（Segmented、按钮式 Radio）用 `--vl-shadow-thumb`，阴影不溢出轨道。
- 不做玻璃、液态玻璃、折射之类的材质主题，除非维护者主动提出。
- 视觉改动先渲染改动前后的真实截图给维护者对比，由维护者选择。

## 动效

遵循 [docs/zh-CN/guides/motion.md](docs/zh-CN/guides/motion.md)（英文版在 `docs/en-US/guides/motion.md`），新组件也按这套体系实现：

- 用 transition 加弹簧令牌，不用一次性的 keyframes，这样动画可以中断：中途关闭会从当前位置折返。
- 元素从触发它的地方出现，关闭时收回去。
- 小而移动距离固定的东西（开关圆点、勾选标记）可以轻微回弹。移动距离长的（滑块、面板、弹层、高度变化）
  用无回弹的平滑弹簧。
- 退出比进入快。按下只加深状态层，不缩放、不位移。
- 时长和缓动只用 `--vl-motion-*` 令牌。开启“减少动态效果”时时长归零。

## 计划与经验

- 多阶段任务的计划写在 `dev/plan.md`，每完成一个阶段更新一次。踩过的坑和经验写在 `dev/lessons.md`。
  需要时再创建这两个文件，`dev/` 不会随 npm 包发布。
- 仓库是公开的：计划、经验、提交信息和示例里都不要写私有项目名、内部业务信息或凭据。
