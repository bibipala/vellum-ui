# 阶段 1：测试可靠性验证（A、CT02/03/04/06/07）

> **后续决定（主代理审查后）：** A 中的 `scripts/browser-provider.ts`（同源模块改由 Node 转发）和浏览器项目
> `maxWorkers: 1` 已撤回。原因在主机网络，不在仓库；在只有回环的网络命名空间里用原配置、默认并发连跑两次都没有
> 导入失败，浏览器项目约 85 秒（单 worker 约 270 秒）。保留了 node / browser 分两步运行和 B–F 的全部改动。
> 下文是 Codex 当时的记录，保留作为诊断过程。

2026-11-24，`stage-1`，全部改动保留未提交。没有修改 `src/` 或生成文件。

## A：导入失败的原因与处理

- 原始完整运行开启 `VITEST_PW_DEBUG=1`：201 条失败请求全部是 `net::ERR_NETWORK_CHANGED`；4 个文件导入失败。
  同一次还复现了原 CommandPalette 测试期待 `se` 却先搜索到 `s` 的竞争。
- 运行期间对失败资源 `/src/components/layout.module.css` 用 curl 请求，Vite 返回 HTTP 200 和正常的转换代码。
  不是 504 Outdated Optimize Dep 或编译错误。
- `ip -ts monitor address` 记录 eth0 的 IPv6 链路本地地址约每 10 秒经历 tentative → dadfailed → 删除。
  这在后续通过的单文件和串行浏览器运行期间也持续出现。内存压力存在，但不能用它解释明确的网络变化错误。
- `scripts/browser-provider.ts` 在继承的 Playwright provider 中仅转发测试服务器同源 script / stylesheet：
  Node HTTP 取回后将状态码、正文原样交给 Chromium；HTTP 错误和模块执行错误不会变成成功。
  `route.fetch` 仅对 ECONNRESET 重试一次，不重试 HTTP 状态；页面关闭后的取消不作为活跃页面的传输失败。
  后注册的 Vitest 模块 mock 路由优先，有真实浏览器回归验证。
- HTML、WebSocket、图片、fetch 等保留浏览器网络路径。初步实验把 HTML 也转发时导致 Chromium 将文档判为不同地址空间、
  WebSocket 报 `ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`，最终实现已移除这种做法。
- Node 和 browser 在 `pnpm test` 中分两步运行；Node 限 4 个 worker，browser 限 1 个。
  4 个浏览器 worker 已消除导入失败，但两次完整运行暴露原有 Appearance tooltip 遮挡菜单和嵌套对话框焦点竞争；
  不改断言、不 force click、不重跑断言，用串行文件减少主机争用。单独复跑 site 的 12 个测试全部通过。
- 串行浏览器诊断运行：50 文件、563 测试全部通过，271.87s。日志唯一的失败请求是示例图片的主动取消。
- 新增 transport 回归：真实模块初始化异常仍拒绝 import，`vi.doMock` 仍能覆盖原模块；1 文件、2 测试通过。

临时日志：`/tmp/vellum-stage1-diagnostic.log`、`/tmp/vellum-stage1-import-response.txt`、
`/tmp/vellum-stage1-network.log`、`/tmp/vellum-stage1-network-full.log`、
`/tmp/vellum-stage1-serial-browser.log`、`/tmp/vellum-stage1-transport.log`。

## B–F：改动

- CT04：guards / tokens 的 antd、theme 导入放在模块级，断言体保持同步；不扩大全局 timeout。
- CT02：integration 只等待最终查询；原生输入事件 + act + 假时钟精确检查 150ms debounce；deferred 请求反向返回、
  abort、关闭、卸载后失败响应都有覆盖。
- CT03：去掉墙钟阈值和 MutationObserver；检查实时 animation / update duration、图例 aria-pressed、系列可见性和 data-rendered。
- CT06：Reasoning 精确推进 Date.now 1600ms、finally 恢复；Form 等展开状态退出，不再额外睡眠 400ms。
- CT07：统一 animationFrame（一帧）、afterPaint（两帧）、frames(n)、sampleFrames；保留原先稳定布局等待的实际帧数。
  两个 scroll driver 每帧应用 120px；共用 longTasks / frameIntervals，在 finally 清理，停止时 takeRecords。

## 单文件验证

每个文件都单独启动 Vitest；性能文件用 perf config，不与其他测试进程并行。

| 文件（test/ 下；浏览器文件在 browser/，perf 文件在 browser/perf/） | 结果 |
| --- | --- |
| `charts-motion.browser.test` | 2 passed (2) |
| `chat-input.browser.test` | 20 passed (20) |
| `chat-list.browser.test` | 13 passed (13) |
| `chat-perf.browser.test` | 3 passed (3) |
| `command-palette.browser.test` | 12 passed (12) |
| `data-table-columns.browser.test` | 17 passed (17) |
| `data-table-perf.browser.test` | 1 failed | 2 passed (3) |
| `data-table-virtual.browser.test` | 5 passed (5) |
| `dialogs.browser.test` | 20 passed (20) |
| `file-preview.browser.test` | 14 passed (14) |
| `form.browser.test` | 6 passed (6) |
| `guards.test` | 10 passed (10) |
| `markdown-stream.browser.test` | 1 passed (1) |
| `markdown.browser.test` | 12 passed (12) |
| `media-image.browser.test` | 8 passed (8) |
| `motion.browser.test` | 16 passed (16) |
| `reasoning-tools.browser.test` | 11 passed (11) |
| `streaming-text.browser.test` | 3 passed (3) |
| `tokens.test` | 32 passed (32) |
| `module-loading.browser.test` | 2 passed (2) |

## 性能预算

`pnpm test:perf --silent=false`：2 文件通过、1 文件失败；6 测试通过、1 测试失败，28.69s。

- DataTable：150 行和 10,000 行均 21 tr / 379 DOM 节点；150 次 × 120px 用时 2544ms；帧间隔 p95 16.8ms、最大 33.3ms。
  大跨度跳转帧间隔为 [50, 66.7, 49.9, 50, 33.4]ms；长任务 [66, 70, 62, 63]ms，超过既有 50ms 预算。
  之前单文件也失败，长任务 [50, 62, 62, 62]ms。保留失败，不提高预算，不在本任务优化生产 DataTable。
- Chat：150 次 × 120px 用时 2533ms、没有长任务；120 段流式增长用时 3183ms、没有长任务、最终距离底部 0px。
- Markdown：不开/开打字机均 10062 bytes、158 chunks；用时 5277/4852ms，p95 16.7/16.7ms，没有长任务。

## 最终质量门槛

- `pnpm lint`：通过，保留 6 条原有 warning；`pnpm typecheck`：通过。
- 第一次完整 `pnpm test` 验收：Node 37 文件 / 420 测试通过（9.92s），browser 51 文件 / 565 测试通过（272.28s），共 88 文件 / 985 测试。
- 第二次连续完整 `pnpm test` 验收：Node 37 文件 / 420 测试通过（9.06s），browser 51 文件 / 565 测试通过（265.58s），共 88 文件 / 985 测试。
- 20 个改动的测试文件逐个运行：19 文件全过、DataTable perf 1 文件中 2 测试过 / 1 测试失败；总计 209 测试通过 / 1 预算失败。
- 最终 `pnpm check`：退出码 0。lint（6 条原有 warning）、typecheck、docs:check、api:check 全部通过；
  Node 37 文件 / 420 测试通过（8.53s），browser 51 文件 / 565 测试通过（266.50s），共 88 文件 / 985 测试。
- 唯一未通过项是单独的 DataTable 性能预算（上文保留原始数字）；其余 A–F 实现与验证已完成。

完整日志：`/tmp/vellum-stage1-final-full-1.log`、`/tmp/vellum-stage1-final-full-2.log`、
`/tmp/vellum-stage1-perf.log`、`/tmp/vellum-stage1-final-check.log`。

诊断时曾误判一个 session 已退出，短暂重叠了两次失败的诊断运行；两者随后退出。以上单文件、性能和完整验收结果均来自顺序运行。
