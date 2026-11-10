/**
 * 语义令牌 → Ant Design ThemeConfig 映射。
 *
 * antd 的主题算法需要 sRGB 颜色来派生色板，因此颜色从 OKLCH 转为十六进制；
 * 同时启用 antd 的 CSS 变量模式，使 antd 组件与自研组件共用同一套令牌、切换主题无需重新生成样式。
 * v3「清透分层」：扁平按钮（次要按钮是中性填充、不描边）、填充式输入框、
 * 层次靠底色，阴影只给浮层。
 */
import { theme as antdTheme, type ThemeConfig } from 'antd'
import type { Density } from '../tokens/component.ts'
import { type Oklch, oklch, toHex } from '../tokens/oklch.ts'
import { borderStrongHover, controlFill, cssVar, type Theme } from './compile.ts'

const withAlpha = (c: Oklch, alpha: number): Oklch => ({ ...c, alpha })

/** antd 的主题算法：(种子令牌, 上一个算法的映射令牌) → 映射令牌。 */
type Algorithm = Extract<NonNullable<ThemeConfig['algorithm']>, (...args: never[]) => unknown>

/**
 * 紧凑密度：只取 antd 紧凑算法收紧后的间距档位（size*，内外边距由它派生）。
 * antd 的紧凑算法还会以小号字（12px）作为基准字号、把控件高度再减 4px，而 fontSize、controlHeight 是种子令牌，
 * 不能在 token 里覆盖回来：正文会变成 12px、控件变成 24px，不符合字号与控件尺寸的规范（密度只改变组件尺寸，
 * 紧凑控件高度 ≥ 28px）。字号与控件高度沿用前一个算法按 toAntdTheme 设定的种子计算的结果。
 */
const compactSpacing: Algorithm = (seed, map) => {
  const base = map ?? antdTheme.defaultAlgorithm(seed)
  const spacing = Object.fromEntries(
    Object.entries(antdTheme.compactAlgorithm(seed, base)).filter(([k]) => k.startsWith('size')),
  )
  return { ...base, ...spacing }
}

const shiftL = (c: Oklch, dl: number): Oklch => oklch(Math.min(1, Math.max(0, c.l + dl)), c.c, c.h)

/** 生成 antd 主题配置。 */
export function toAntdTheme(
  theme: Theme,
  options: { readonly density?: Density } = {},
): ThemeConfig {
  const t = theme
  const c = t.colors
  const s = t.scale
  const dark = t.mode === 'dark'
  const compact = options.density === 'compact'
  const algorithm: Algorithm[] = [dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm]
  if (compact) algorithm.push(compactSpacing)
  // 状态层：悬停 6% / 按下 10%，深色 8% / 12%
  const fillHover = toHex(withAlpha(c.textPrimary, dark ? 0.08 : 0.06))
  const fillActive = toHex(withAlpha(c.textPrimary, dark ? 0.12 : 0.1))
  const fillSelected = toHex(withAlpha(c.accent, dark ? 0.18 : 0.1))
  const halo = toHex(withAlpha(c.accent, dark ? 0.3 : 0.2))
  // 实色的中性填充及其悬停：填充式输入框（variant="filled"）、分段控件轨道
  const fill = toHex(c.fill)
  const fillHoverSolid = toHex(shiftL(c.fill, dark ? 0.03 : -0.025))
  // 主按钮：悬停略亮、按下略暗（两种模式一致）
  const primary = toHex(c.accentFill)
  const primaryHover = toHex(shiftL(c.accentFill, 0.04))
  const primaryActive = toHex(shiftL(c.accentFill, -0.05))
  const sec = (ms: number) => `${ms / 1000}s`
  // 输入类控件（默认描边式）：表面色底配细描边（borderStrong，低对比的半透明色，不是一圈实心灰线），悬停时描边
  // 加深；聚焦时描边变为强调色并显示光环，错误、警告时为状态色描边与同色光环。
  // 描边让输入框与中性填充的次要按钮区分开（可输入的「框」与可按下的「块」），在画布与卡片上都有清晰的边界。
  // filled 变体（variant="filled"）沿用中性填充：底色 colorFillTertiary，悬停 colorFillSecondary
  const borderHover = toHex(borderStrongHover(c.borderStrong))
  const statusHalo = (color: Oklch) => `0 0 0 3px ${toHex(withAlpha(color, dark ? 0.3 : 0.18))}`
  const field = {
    colorFillTertiary: fill,
    colorFillSecondary: fillHoverSolid,
    hoverBorderColor: borderHover,
    activeBorderColor: toHex(c.accent),
    activeShadow: `0 0 0 3px ${halo}`,
    errorActiveShadow: statusHalo(c.danger),
    warningActiveShadow: statusHalo(c.warning),
  }
  return {
    algorithm,
    cssVar: { prefix: 'vl-ant', key: `vl-${t.id}-${t.mode}` },
    hashed: false,
    token: {
      colorPrimary: primary,
      colorPrimaryHover: primaryHover,
      colorPrimaryActive: primaryActive,
      colorLink: toHex(c.accentText),
      colorLinkHover: toHex(shiftL(c.accentText, dark ? 0.06 : -0.06)),
      colorLinkActive: toHex(shiftL(c.accentText, dark ? -0.04 : 0.04)),
      colorError: toHex(c.danger),
      colorWarning: toHex(c.warning),
      colorSuccess: toHex(c.success),
      colorInfo: toHex(c.info),
      colorTextBase: toHex(c.textPrimary),
      colorBgBase: toHex(c.bgSurface),
      colorBgLayout: toHex(c.bgCanvas),
      colorBgContainer: toHex(c.bgSurface),
      colorBgElevated: toHex(c.bgElevated),
      // 对话框与抽屉的遮罩：带一点强调色色相的半透明暗色，比 antd 的 45% 纯黑轻，页面仍然可辨
      colorBgMask: toHex(
        dark ? oklch(0.1, 0.01, c.textPrimary.h, 0.6) : oklch(0.2, 0.02, c.textPrimary.h, 0.32),
      ),
      colorBgSpotlight: toHex(c.bgElevated),
      colorText: toHex(c.textPrimary),
      colorTextSecondary: toHex(c.textSecondary),
      colorTextTertiary: toHex(c.textTertiary),
      colorTextQuaternary: toHex(withAlpha(c.textTertiary, 0.7)),
      colorTextLightSolid: toHex(c.textOnAccent),
      colorTextHeading: toHex(c.textPrimary),
      colorBorder: toHex(c.borderStrong),
      colorBorderSecondary: toHex(c.border),
      // 禁用的按钮、输入框、选择器、标签不描边：只靠更浅的底色与文字表示不可用（antd 默认加一圈灰色描边）
      colorBorderDisabled: 'transparent',
      colorSplit: toHex(c.border),
      colorFill: fillActive,
      colorFillSecondary: fillHover,
      colorFillTertiary: fillHover,
      colorFillQuaternary: toHex(withAlpha(c.textPrimary, dark ? 0.04 : 0.03)),
      colorFillAlter: toHex(c.bgSunken),
      controlItemBgHover: fillHover,
      controlItemBgActive: fillSelected,
      controlItemBgActiveHover: fillSelected,
      controlOutline: halo,
      controlOutlineWidth: 3,
      // 键盘焦点环：antd 组件的焦点轮廓用 lineWidthFocus 与 colorPrimaryBorder 绘制，
      // 默认是 3px 浅色。统一为 2px 强调色；外扩 2px 由 base.css 补齐（antd 的外扩写死为 1px）。
      // colorPrimaryBorder 在 antd 中另外只用于未导出的 Slider、Upload 与按钮的 filled 变体
      lineWidthFocus: 2,
      colorPrimaryBorder: toHex(c.accent),
      fontFamily: s.fontFamilyBody,
      fontFamilyCode: s.fontFamilyMono,
      fontSize: s.fontSize.md,
      fontSizeHeading1: s.fontSize['4xl'],
      fontSizeHeading2: s.fontSize['3xl'],
      fontSizeHeading3: s.fontSize['2xl'],
      fontSizeHeading4: s.fontSize.xl,
      fontWeightStrong: s.fontWeight.semibold,
      lineWidth: s.borderWidth,
      lineHeight: s.lineHeightBody,
      borderRadius: s.radius.md,
      borderRadiusSM: s.radius.sm,
      borderRadiusLG: s.radius.lg,
      borderRadiusXS: 4,
      borderRadiusOuter: s.radius.md,
      controlHeight: compact ? 28 : 32,
      controlHeightSM: compact ? 24 : 28,
      controlHeightLG: compact ? 32 : 40,
      wireframe: false,
      motionDurationFast: sec(s.motionDurationFast),
      motionDurationMid: sec(s.motionDurationBase),
      motionDurationSlow: sec(s.motionDurationSlow),
      motionEaseInOut: s.motionEaseStandard,
      motionEaseOut: s.motionEaseStandard,
      motionEaseOutBack: s.motionEaseStandard,
      boxShadow: cssVar('shadow-float'),
      boxShadowSecondary: cssVar('shadow-float'),
      // antd 用它画 Segmented 的选中项（另有 Tour 与未封装的 Card）：轨道中的选中项只用紧贴的阴影
      boxShadowTertiary: cssVar('shadow-thumb'),
    },
    components: {
      // 次要按钮（antd 默认按钮）：中性填充、不描边；主按钮为实色，不加阴影、渐变
      Button: {
        fontWeight: s.fontWeight.medium,
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
        // 次要按钮的底色是半透明的中性色（controlFill），放在画布、卡片与深色浮层上都看得见
        defaultBg: toHex(controlFill(c.textPrimary, t.mode, 'rest')),
        defaultBorderColor: 'transparent',
        defaultColor: toHex(c.textPrimary),
        defaultHoverBg: toHex(controlFill(c.textPrimary, t.mode, 'hover')),
        defaultHoverBorderColor: 'transparent',
        defaultHoverColor: toHex(c.textPrimary),
        defaultActiveBg: toHex(controlFill(c.textPrimary, t.mode, 'active')),
        // 禁用：比静止时更浅的底色，配禁用文字色
        defaultBgDisabled: toHex(withAlpha(c.textPrimary, dark ? 0.05 : 0.04)),
        defaultActiveBorderColor: 'transparent',
        defaultActiveColor: toHex(c.textPrimary),
        textHoverBg: fillHover,
        textTextHoverColor: toHex(c.textPrimary),
        // 文字按钮的左右内边距约为高度的一半（32px → 16px），中文按钮两侧留白充足，不显得局促；
        // antd 默认的小号按钮只有 7px
        paddingInline: 16,
        paddingInlineSM: 12,
        paddingInlineLG: 20,
        iconGap: 6,
      },
      Input: { ...field, paddingInline: 12, paddingInlineSM: 10, paddingInlineLG: 14 },
      InputNumber: field,
      Select: {
        ...field,
        optionSelectedBg: fillSelected,
        optionActiveBg: fillHover,
        optionSelectedColor: toHex(c.accentText),
        optionSelectedFontWeight: s.fontWeight.medium,
        activeOutlineColor: halo,
      },
      TreeSelect: field,
      // 级联选择：选中项与 Select 一致（强调色浅底配强调色文字）
      Cascader: {
        ...field,
        optionSelectedBg: fillSelected,
        optionSelectedColor: toHex(c.accentText),
        optionSelectedFontWeight: s.fontWeight.medium,
      },
      DatePicker: field,
      // 复选框 16px，圆角 4px（控件的 sm 圆角 6px 放在 16px 的小方块上过圆，像圆点）
      Checkbox: { colorBorder: toHex(c.fillStrong), borderRadiusSM: 4 },
      Radio: { colorBorder: toHex(c.fillStrong) },
      Layout: {
        bodyBg: toHex(c.bgCanvas),
        headerBg: 'transparent',
        siderBg: toHex(c.bgCanvas),
        headerColor: toHex(c.textPrimary),
        headerHeight: 52,
        headerPadding: '0 20px',
      },
      Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        itemColor: toHex(c.textSecondary),
        itemHoverColor: toHex(c.textPrimary),
        itemHoverBg: fillHover,
        itemSelectedBg: fillSelected,
        itemSelectedColor: toHex(c.accentText),
        itemActiveBg: fillActive,
        itemBorderRadius: s.radius.md,
        itemHeight: compact ? 30 : 34,
        itemMarginInline: 8,
        itemMarginBlock: 2,
        groupTitleColor: toHex(c.textTertiary),
        groupTitleFontSize: 11,
        activeBarBorderWidth: 0,
        iconSize: 16,
        collapsedIconSize: 18,
      },
      Modal: {
        contentBg: toHex(c.bgElevated),
        headerBg: toHex(c.bgElevated),
        footerBg: 'transparent',
        titleFontSize: s.fontSize.lg,
        borderRadiusLG: s.radius['2xl'],
      },
      Drawer: { colorBgElevated: toHex(c.bgElevated) },
      // 描述列表：标签为次要文字色、不加冒号（Descriptions 设置 colon={false}），标签与值之间 12px
      Descriptions: {
        labelColor: toHex(c.textSecondary),
        colonMarginRight: 12,
        colonMarginLeft: 0,
      },
      // 表单：标签不加冒号（Form 默认 colon=false），标签与控件之间 12px；行内布局换行后，两行之间留 16px
      Form: {
        labelColonMarginInlineStart: 0,
        labelColonMarginInlineEnd: 12,
        inlineItemMarginBottom: 16,
      },
      // 选中指示（下划线、滑块）在选项之间滑动 200ms；antd 用 motionDurationSlow 做这段动画
      Tabs: {
        inkBarColor: toHex(c.accent),
        itemSelectedColor: toHex(c.textPrimary),
        itemHoverColor: toHex(c.textPrimary),
        itemColor: toHex(c.textSecondary),
        titleFontSize: s.fontSize.md,
        motionDurationSlow: sec(s.motionDurationBase),
      },
      Tag: {
        defaultBg: fillHover,
        defaultColor: toHex(c.textSecondary),
        borderRadiusSM: 999,
      },
      Segmented: {
        trackBg: fill,
        itemSelectedBg: toHex(dark ? c.fillStrong : c.bgSurface),
        itemHoverBg: fillHover,
        borderRadius: s.radius.md,
        borderRadiusSM: s.radius.sm,
        motionDurationSlow: sec(s.motionDurationBase),
      },
      // 提示气泡在两种模式下都是深底浅字，和页面内容明显区分
      Tooltip: {
        colorBgSpotlight: toHex(
          dark ? oklch(0.32, 0.01, c.textPrimary.h) : oklch(0.24, 0.012, c.textPrimary.h),
        ),
        colorTextLightSolid: '#ffffff',
      },
      Card: { colorBgContainer: toHex(c.bgSurface), headerFontSize: s.fontSize.md },
      Tree: {
        nodeHoverBg: fillHover,
        nodeSelectedBg: fillSelected,
        directoryNodeSelectedBg: fillSelected,
      },
      Badge: { dotSize: 8, statusSize: 8 },
      Switch: {
        trackHeight: 20,
        trackMinWidth: 36,
        handleSize: 16,
        colorTextQuaternary: toHex(c.fillStrong),
        colorTextTertiary: toHex(shiftL(c.fillStrong, dark ? 0.05 : -0.05)),
      },
      Avatar: { colorTextPlaceholder: toHex(c.textSecondary) },
      // 当前页：强调色浅底配强调色文字，不描边（描边由 base.css 去掉）；其他页悬停、按下用状态层
      // （antd 取 colorBgTextHover / colorBgTextActive，即上面的 fillHover / fillActive）
      Pagination: {
        // 页码不带表面色底：放在画布或卡片上都只有文字，悬停时才出现状态层
        itemBg: 'transparent',
        itemLinkBg: 'transparent',
        itemActiveBg: fillSelected,
        itemActiveColor: toHex(c.accentText),
        itemActiveColorHover: toHex(c.accentText),
      },
      Message: { contentBg: toHex(c.bgElevated) },
      Notification: { colorBgElevated: toHex(c.bgElevated) },
      // 滑块：轨道为中性填充（较深的一档，细轨道在画布与卡片上都看得见），选中段与手柄为强调色；
      // 手柄聚焦的外圈用光环色（键盘焦点环另由 base.css 统一）
      Slider: {
        railBg: toHex(c.fillStrong),
        railHoverBg: toHex(shiftL(c.fillStrong, dark ? 0.03 : -0.025)),
        trackBg: toHex(c.accent),
        trackHoverBg: toHex(shiftL(c.accent, dark ? 0.04 : -0.04)),
        handleColor: toHex(c.accent),
        handleActiveColor: toHex(c.accent),
        handleActiveOutlineColor: halo,
        dotBorderColor: toHex(c.fillStrong),
        dotActiveBorderColor: toHex(c.accent),
        trackBgDisabled: toHex(c.fillStrong),
      },
      // 面包屑：路径为次要文字，悬停变为正文色；当前页为正文色；分隔符为第三级文字色
      Breadcrumb: {
        itemColor: toHex(c.textSecondary),
        linkColor: toHex(c.textSecondary),
        linkHoverColor: toHex(c.textPrimary),
        lastItemColor: toHex(c.textPrimary),
        separatorColor: toHex(c.textTertiary),
      },
      // 气泡卡片与颜色选择的面板：浮层表面色（阴影由 base.css 统一）
      Popover: { colorBgElevated: toHex(c.bgElevated) },
    },
  }
}
