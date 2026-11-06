# 字体

只使用 SIL Open Font License 1.1 的开源字体：

| 字体 | 用途 | 来源 | 许可证 |
| --- | --- | --- | --- |
| Inter（可变，字重 + 光学尺寸） | 界面西文、数字 | npm `@fontsource-variable/inter` | SIL OFL 1.1（包内 `LICENSE`） |
| JetBrains Mono（可变） | 编号、代码、接口名 | npm `@fontsource-variable/jetbrains-mono` | SIL OFL 1.1（包内 `LICENSE`） |
| 中文 | 正文与界面 | 系统字体：微软雅黑 UI / 苹方 / 思源黑体（Noto Sans CJK SC） | 不随包分发 |

- `src/fonts.css`（包导出 `vellum-ui/fonts.css`）通过 `@import` 引入，前端构建时字体文件进入产物，离线可用。
- 以安装包等形式分发应用时，把两个字体包中的 `LICENSE` 一并附上。
- 不使用衬线与书法类字体。
