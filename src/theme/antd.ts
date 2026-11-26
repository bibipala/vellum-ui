/**
 * 语义令牌 → Ant Design ThemeConfig 映射。
 *
 * antd 的主题算法需要 sRGB 颜色来派生色板，因此颜色从 OKLCH 转为十六进制；
 * 同时启用 antd 的 CSS 变量模式，使 antd 组件与自研组件共用同一套令牌、切换主题无需重新生成样式。
 * v3「清透分层」：次要按钮是中性填充、不描边，实色按钮轻微凸起；输入框是不描边的凹槽（填充式），
 * 层次靠底色，阴影只给浮层。
 */
import { theme as antdTheme, type ThemeConfig } from 'antd'
import { controlGeometry, type Density, switchGeometry } from '../tokens/component.ts'
import { type Oklch, toHex } from '../tokens/oklch.ts'
import { fixedGeometry } from '../tokens/semantic.ts'
import { cssVar, type Theme } from './compile.ts'
import { deriveColors } from './derive.ts'

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

/**
 * 生成 antd 主题配置。这里只做映射：派生的颜色来自 deriveColors、控件尺寸来自 controlGeometry，与本库 CSS 变量的
 * 取值是同一份（两边不一致的几处，用 deriveColors 中 antd 前缀的那一份）。
 */
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
  const d = deriveColors(c, t.mode)
  const geometry = controlGeometry(options.density ?? 'comfortable')
  // 两种写法：
  // - 全局令牌（种子、映射令牌，包括写在某个组件里的同名覆盖，如输入框的 colorFillTertiary）给十六进制：antd 的主题
  //   算法与组件的 prepareComponentToken 会对它们做颜色运算（如 InputNumber 由 colorFillSecondary 算出按钮底色，
  //   Image 由 colorBgMask 算出操作按钮的底色），CSS 变量的引用算不出来；
  // - 组件令牌中取值正好是本库某个 CSS 变量的颜色，引用该变量（与下面的 shadow-* 相同）。antd 只把组件令牌写成 CSS
  //   变量的声明（--vl-ant-<组件>-<令牌>），样式与 prepareComponentToken 都不对它做运算；这样局部改写本库的变量（如
  //   toCssText 的选择器、看图工具栏换掉的文字与填充色）时，antd 组件随之变化，而不是停在全局主题的快照上
  // 状态层：悬停 6% / 按下 10%，深色 8% / 12%（全局令牌用十六进制，组件令牌引用 CSS 变量）
  const fillHover = toHex(d.fillHover)
  const fillActive = toHex(d.fillActive)
  const fillSelected = toHex(d.fillSelected)
  const halo = toHex(d.focusHalo)
  // 动效时长引用本库的令牌（而不是秒数的快照）：antd 在各组件根元素上声明的 --vl-ant-motion-duration-* 随之变化，
  // 「减少动态效果」时一起归零。至少 1ms：时长为 0 的过渡不触发 transitionend，antd 的动画状态机（rc-motion）会停在
  // 进场、离场中直到 motionDeadline（与 base.css 中弹层、折叠的做法相同）
  const motionDuration = (token: string) => `max(${cssVar(token)}, 1ms)`
  // 聚焦光环：宽度引用本库的 focus-halo-width
  const haloShadow = (color: string) => `0 0 0 ${cssVar('focus-halo-width')} ${color}`
  // 输入类控件（默认填充式）：不描边的「凹槽」，底色是比次要按钮浅一档的半透明中性色（fieldFill），上沿有一道极淡的
  // 内阴影（base.css 的 shadow-field）；悬停时底色加深，聚焦时亮起为表面色，配强调色细边与光环，错误、警告时为状态色
  // 细边与同色光环。凹下去的「槽」与凸起或平铺的按钮「块」靠明暗区分，不靠一圈描边。
  // variant="outlined" 仍可用：表面色底配细描边（borderStrong），悬停时描边加深（hoverBorderColor）
  // filled 变体（variant="filled"）沿用中性填充：底色 colorFillTertiary，悬停 colorFillSecondary
  const statusHalo = (color: Oklch) => haloShadow(toHex(color))
  const field = {
    colorFillTertiary: toHex(d.fieldFill.rest),
    colorFillSecondary: toHex(d.fieldFill.hover),
    // 聚焦时凹槽「亮起」为表面色（深色模式是更亮一档的浮层色）
    activeBg: cssVar(dark ? 'color-bg-elevated' : 'color-bg-surface'),
    hoverBorderColor: cssVar('color-border-strong-hover'),
    activeBorderColor: cssVar('color-accent'),
    activeShadow: haloShadow(cssVar('color-focus-halo')),
    // 偏差：与填充式（base.css）的光环透明度不同，见 deriveColors 的 statusHalo
    errorActiveShadow: statusHalo(d.antdStatusHalo.danger),
    warningActiveShadow: statusHalo(d.antdStatusHalo.warning),
  }
  const fieldPadding = {
    paddingInline: geometry.fieldPaddingInline.md,
    paddingInlineSM: geometry.fieldPaddingInline.sm,
    paddingInlineLG: geometry.fieldPaddingInline.lg,
  }
  const switchSize = switchGeometry(options.density ?? 'comfortable')
  return {
    algorithm,
    cssVar: { prefix: 'vl-ant', key: `vl-${t.id}-${t.mode}` },
    hashed: false,
    token: {
      // 主按钮：悬停略亮、按下略暗（两种模式一致）。偏差：与 color-accent-fill-hover / -active 不同，见 deriveColors
      colorPrimary: toHex(c.accentFill),
      colorPrimaryHover: toHex(d.antdPrimaryHover),
      colorPrimaryActive: toHex(d.antdPrimaryActive),
      // 链接。偏差：悬停、按下与 color-accent-text-hover / -active 不同，见 deriveColors
      colorLink: toHex(c.accentText),
      colorLinkHover: toHex(d.antdLinkHover),
      colorLinkActive: toHex(d.antdLinkActive),
      colorError: toHex(c.danger),
      colorWarning: toHex(c.warning),
      colorSuccess: toHex(c.success),
      colorInfo: toHex(c.info),
      colorTextBase: toHex(c.textPrimary),
      colorBgBase: toHex(c.bgSurface),
      colorBgLayout: toHex(c.bgCanvas),
      colorBgContainer: toHex(c.bgSurface),
      colorBgElevated: toHex(c.bgElevated),
      // 对话框与抽屉的遮罩：与 CSS 变量 color-mask 同一个值。保持十六进制：antd 的 Image 对它做颜色运算
      colorBgMask: toHex(d.mask),
      colorBgSpotlight: toHex(c.bgElevated),
      colorText: toHex(c.textPrimary),
      colorTextSecondary: toHex(c.textSecondary),
      colorTextTertiary: toHex(c.textTertiary),
      colorTextQuaternary: toHex(d.textQuaternary),
      colorTextLightSolid: toHex(c.textOnAccent),
      colorTextHeading: toHex(c.textPrimary),
      colorBorder: toHex(c.borderStrong),
      colorBorderSecondary: toHex(c.border),
      // 禁用的按钮、输入框、选择器、标签不描边：只靠更浅的底色与文字表示不可用（antd 默认加一圈灰色描边）
      colorBorderDisabled: 'transparent',
      // 禁用的输入框：比静止时明显更浅的底色（见 deriveColors 的 fieldFill），配更淡的占位文字与图标（base.css）
      colorBgContainerDisabled: toHex(d.fieldFill.disabled),
      colorSplit: toHex(c.border),
      colorFill: fillActive,
      colorFillSecondary: fillHover,
      colorFillTertiary: fillHover,
      colorFillQuaternary: toHex(d.fillFaint),
      colorFillAlter: toHex(c.bgSunken),
      controlItemBgHover: fillHover,
      controlItemBgActive: fillSelected,
      controlItemBgActiveHover: fillSelected,
      controlOutline: halo,
      controlOutlineWidth: fixedGeometry.focusHaloWidth,
      // 键盘焦点环：antd 组件的焦点轮廓用 lineWidthFocus 与 colorPrimaryBorder 绘制，
      // 默认是 3px 浅色。统一为本库的焦点环（focus-ring-width，2px）与强调色；外扩由 base.css 补齐（antd 的外扩写死为 1px）。
      // colorPrimaryBorder 在 antd 中另外只用于未导出的 Slider、Upload 与按钮的 filled 变体
      lineWidthFocus: fixedGeometry.focusRingWidth,
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
      borderRadiusXS: fixedGeometry.radiusXs,
      borderRadiusOuter: s.radius.md,
      controlHeight: geometry.height.md,
      controlHeightSM: geometry.height.sm,
      controlHeightLG: geometry.height.lg,
      wireframe: false,
      motionDurationFast: motionDuration('motion-duration-fast'),
      motionDurationMid: motionDuration('motion-duration-base'),
      motionDurationSlow: motionDuration('motion-duration-slow'),
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
        defaultBg: cssVar('color-fill-control'),
        defaultBorderColor: 'transparent',
        defaultColor: cssVar('color-text-primary'),
        defaultHoverBg: toHex(d.controlFill.hover),
        defaultHoverBorderColor: 'transparent',
        defaultHoverColor: cssVar('color-text-primary'),
        defaultActiveBg: toHex(d.controlFill.active),
        // 禁用：比静止时更浅的底色，配禁用文字色
        defaultBgDisabled: toHex(d.controlFill.disabled),
        defaultActiveBorderColor: 'transparent',
        defaultActiveColor: cssVar('color-text-primary'),
        textHoverBg: cssVar('color-fill-hover'),
        textTextHoverColor: cssVar('color-text-primary'),
        // 按钮的左右内边距为高度的一半（36px → 18px），中文按钮两侧留白充足，不显得局促；
        // antd 默认的小号按钮只有 7px
        paddingInline: compact ? 14 : 18,
        paddingInlineSM: compact ? 10 : 14,
        paddingInlineLG: compact ? 18 : 24,
        iconGap: 8,
      },
      // 输入类控件左右的内边距一致（14 / 12 / 16px）：表单里上下相邻的输入框、数字输入、日期，文字的起点对齐。
      // 选择器（Select、TreeSelect、Cascader）的内边距不是组件令牌，在 base.css 中用同样的取值覆盖
      Input: { ...field, ...fieldPadding },
      InputNumber: { ...field, ...fieldPadding },
      Select: {
        ...field,
        optionSelectedBg: cssVar('color-fill-selected'),
        optionActiveBg: cssVar('color-fill-hover'),
        optionSelectedColor: cssVar('color-accent-text'),
        optionSelectedFontWeight: s.fontWeight.medium,
        activeOutlineColor: cssVar('color-focus-halo'),
      },
      TreeSelect: field,
      // 级联选择：选中项与 Select 一致（强调色浅底配强调色文字）
      Cascader: {
        ...field,
        optionSelectedBg: cssVar('color-fill-selected'),
        optionSelectedColor: cssVar('color-accent-text'),
        optionSelectedFontWeight: s.fontWeight.medium,
      },
      DatePicker: { ...field, ...fieldPadding },
      // 复选框 16px，圆角 radius-xs（4px；控件的 sm 圆角放在 16px 的小方块上过圆，像圆点）
      Checkbox: { colorBorder: toHex(c.fillStrong), borderRadiusSM: fixedGeometry.radiusXs },
      Radio: { colorBorder: toHex(c.fillStrong) },
      Layout: {
        bodyBg: cssVar('color-bg-canvas'),
        headerBg: 'transparent',
        siderBg: cssVar('color-bg-canvas'),
        headerColor: cssVar('color-text-primary'),
        headerHeight: 52,
        headerPadding: '0 20px',
      },
      Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        itemColor: cssVar('color-text-secondary'),
        itemHoverColor: cssVar('color-text-primary'),
        itemHoverBg: cssVar('color-fill-hover'),
        itemSelectedBg: cssVar('color-fill-selected'),
        itemSelectedColor: cssVar('color-accent-text'),
        itemActiveBg: cssVar('color-fill-active'),
        itemBorderRadius: s.radius.md,
        itemHeight: compact ? 32 : 36,
        itemMarginInline: 8,
        itemMarginBlock: 2,
        groupTitleColor: cssVar('color-text-tertiary'),
        groupTitleFontSize: s.fontSize['2xs'],
        activeBarBorderWidth: 0,
        iconSize: 16,
        collapsedIconSize: 18,
      },
      Modal: {
        contentBg: cssVar('color-bg-elevated'),
        headerBg: cssVar('color-bg-elevated'),
        footerBg: 'transparent',
        titleFontSize: s.fontSize.lg,
        borderRadiusLG: s.radius['2xl'],
      },
      Drawer: { colorBgElevated: toHex(c.bgElevated) },
      // 描述列表：标签为次要文字色、不加冒号（Descriptions 设置 colon={false}），标签与值之间 12px
      Descriptions: {
        labelColor: cssVar('color-text-secondary'),
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
        inkBarColor: cssVar('color-accent'),
        itemSelectedColor: cssVar('color-text-primary'),
        itemHoverColor: cssVar('color-text-primary'),
        itemColor: cssVar('color-text-secondary'),
        titleFontSize: s.fontSize.md,
        motionDurationSlow: motionDuration('motion-duration-base'),
      },
      Tag: {
        defaultBg: cssVar('color-fill-hover'),
        defaultColor: cssVar('color-text-secondary'),
        borderRadiusSM: s.radius.full,
      },
      Segmented: {
        trackBg: cssVar('color-fill'),
        itemSelectedBg: cssVar(dark ? 'color-fill-strong' : 'color-bg-surface'),
        itemHoverBg: cssVar('color-fill-hover'),
        borderRadius: s.radius.md,
        borderRadiusSM: s.radius.sm,
        motionDurationSlow: motionDuration('motion-duration-base'),
      },
      // 提示气泡在两种模式下都是深底浅字，和页面内容明显区分
      Tooltip: {
        colorBgSpotlight: toHex(d.tooltipBg),
        colorTextLightSolid: '#ffffff',
      },
      Card: { colorBgContainer: toHex(c.bgSurface), headerFontSize: s.fontSize.md },
      // 树不带自己的底色：放在卡片、侧栏或下拉弹层里都取所在表面的颜色（antd 默认是一块没有内边距的表面色底板）
      Tree: {
        colorBgContainer: 'transparent',
        nodeHoverBg: cssVar('color-fill-hover'),
        nodeSelectedBg: cssVar('color-fill-selected'),
        directoryNodeSelectedBg: cssVar('color-fill-selected'),
      },
      Badge: { dotSize: 8, statusSize: 8 },
      // 开关的尺寸与本库的组件令牌 switch-* 同一份取值（base.css 由它们算出手柄的平移距离）
      Switch: {
        trackHeight: switchSize.trackHeight,
        trackMinWidth: switchSize.trackWidth,
        handleSize: switchSize.handleSize,
        trackPadding: switchSize.trackPadding,
        trackHeightSM: switchSize.trackHeightSm,
        trackMinWidthSM: switchSize.trackWidthSm,
        handleSizeSM: switchSize.handleSizeSm,
        colorTextQuaternary: toHex(c.fillStrong),
        colorTextTertiary: toHex(d.switchTrackHover),
      },
      Avatar: { colorTextPlaceholder: toHex(c.textSecondary) },
      // 当前页：强调色浅底配强调色文字，不描边（描边由 base.css 去掉）；其他页悬停、按下用状态层
      // （antd 取 colorBgTextHover / colorBgTextActive，即上面的 fillHover / fillActive）
      Pagination: {
        // 页码不带表面色底：放在画布或卡片上都只有文字，悬停时才出现状态层
        itemBg: 'transparent',
        itemLinkBg: 'transparent',
        itemActiveBg: cssVar('color-fill-selected'),
        itemActiveColor: cssVar('color-accent-text'),
        itemActiveColorHover: cssVar('color-accent-text'),
      },
      Message: { contentBg: cssVar('color-bg-elevated') },
      Notification: { colorBgElevated: toHex(c.bgElevated) },
      // 滑块：轨道为中性填充（较深的一档，细轨道在画布与卡片上都看得见），选中段与手柄为强调色；
      // 手柄聚焦的外圈用光环色（键盘焦点环另由 base.css 统一）
      Slider: {
        railBg: cssVar('color-fill-strong'),
        railHoverBg: toHex(d.sliderRailHover),
        trackBg: cssVar('color-accent'),
        trackHoverBg: toHex(d.sliderTrackHover),
        handleColor: cssVar('color-accent'),
        handleActiveColor: cssVar('color-accent'),
        handleActiveOutlineColor: cssVar('color-focus-halo'),
        dotBorderColor: cssVar('color-fill-strong'),
        dotActiveBorderColor: cssVar('color-accent'),
        trackBgDisabled: cssVar('color-fill-strong'),
      },
      // 面包屑：路径为次要文字，悬停变为正文色；当前页为正文色；分隔符为第三级文字色
      Breadcrumb: {
        itemColor: cssVar('color-text-secondary'),
        linkColor: cssVar('color-text-secondary'),
        linkHoverColor: cssVar('color-text-primary'),
        lastItemColor: cssVar('color-text-primary'),
        separatorColor: cssVar('color-text-tertiary'),
      },
      // 气泡卡片与颜色选择的面板：浮层表面色（阴影由 base.css 统一）
      Popover: { colorBgElevated: toHex(c.bgElevated) },
    },
  }
}
