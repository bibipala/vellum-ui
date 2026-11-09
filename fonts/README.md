# Fonts

**English** | [简体中文](#简体中文)

Bundled fonts use the SIL Open Font License 1.1. Chinese text uses fonts installed on the user's system.

| Font | Use | Source | License |
| --- | --- | --- | --- |
| Inter (variable weight and optical size) | Latin text and numbers | `@fontsource-variable/inter` | SIL OFL 1.1; `LICENSE` in the package |
| JetBrains Mono (variable) | Codes and identifiers | `@fontsource-variable/jetbrains-mono` | SIL OFL 1.1; `LICENSE` in the package |
| Microsoft YaHei UI, PingFang SC, Noto Sans CJK SC | Chinese text | System fonts | Not redistributed |

The optional `vellum-ui/fonts.css` entry imports the two font packages. A frontend build bundles the font files
for offline use. Include both packages' license files when distributing an application. The default typography
uses sans-serif and monospace fonts.

## 简体中文

[English](#fonts) | **简体中文**

打包的字体均采用 SIL Open Font License 1.1；中文使用用户系统已安装的字体。

| 字体 | 用途 | 来源 | 许可证 |
| --- | --- | --- | --- |
| Inter（可变字重与光学尺寸） | 西文与数字 | `@fontsource-variable/inter` | SIL OFL 1.1，包内 `LICENSE` |
| JetBrains Mono（可变） | 代码与标识符 | `@fontsource-variable/jetbrains-mono` | SIL OFL 1.1，包内 `LICENSE` |
| 微软雅黑 UI、苹方、Noto Sans CJK SC | 中文 | 系统字体 | 不随包分发 |

可选入口 `vellum-ui/fonts.css` 引入两个字体包，前端构建时打包字体文件以支持离线使用。分发应用时须附带两个包的
许可证文件。默认排版采用无衬线字体与等宽字体。
