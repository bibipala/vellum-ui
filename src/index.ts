/**
 * vellum-ui —— 基于 Ant Design 的 React 组件库：设计令牌、运行时主题与内置交互规范。
 *
 * antd 只作为内部实现：使用方从本包导入组件，不直接导入 antd。
 */

export { Markdown, type MarkdownProps } from './components/ai/Markdown.tsx'
export {
  Message,
  type MessageAuthor,
  type MessageProps,
  type MessageStatus,
} from './components/ai/Message.tsx'
export {
  MessageActions,
  type MessageActionsProps,
  type MessageFeedback,
} from './components/ai/MessageActions.tsx'
export {
  MessageList,
  type MessageListHandle,
  type MessageListProps,
} from './components/ai/MessageList.tsx'
export {
  PromptInput,
  type PromptInputHandle,
  type PromptInputProps,
  type PromptInputRejectReason,
  type PromptInputSubmit,
} from './components/ai/PromptInput.tsx'
export {
  type PromptSuggestion,
  PromptSuggestions,
  type PromptSuggestionsProps,
} from './components/ai/PromptSuggestions.tsx'
export { Reasoning, type ReasoningProps } from './components/ai/Reasoning.tsx'
export {
  Citation,
  type CitationProps,
  type SourceItem,
  Sources,
  type SourcesProps,
} from './components/ai/Sources.tsx'
export { StreamingText, type StreamingTextProps } from './components/ai/StreamingText.tsx'
export {
  type ReadStreamOptions,
  readSSE,
  readTextStream,
  type ServerSentEvent,
  StreamResponseError,
  type StreamSource,
} from './components/ai/stream.ts'
export {
  type ToolCallItem,
  type ToolCallStatus,
  ToolCalls,
  type ToolCallsProps,
} from './components/ai/ToolCalls.tsx'
export {
  type StreamState,
  type StreamStatus,
  type UseStreamOptions,
  useStream,
} from './components/ai/useStream.ts'
export {
  Button,
  type ButtonProps,
  type ControlSize,
  Heading,
  type HeadingProps,
} from './components/basic.tsx'
export { CodeBlock, type CodeBlockProps } from './components/CodeBlock.tsx'
export {
  CommandPalette,
  type CommandPaletteItem,
  type CommandPaletteProps,
} from './components/CommandPalette.tsx'
export {
  ContextMenu,
  type ContextMenuAction,
  type ContextMenuDivider,
  type ContextMenuItem,
  type ContextMenuProps,
} from './components/ContextMenu.tsx'
export { CopyButton, type CopyButtonProps } from './components/CopyButton.tsx'
export { BarChart, type BarChartProps } from './components/charts/BarChart.tsx'
export {
  type ChartCommonProps,
  ChartContainer,
  type ChartContainerProps,
  type ChartLegendItem,
  type ChartTableColumn,
  type ChartTableData,
} from './components/charts/ChartContainer.tsx'
export type { ChartXValue } from './components/charts/cartesian.ts'
export type { ChartColorSlot, ValueFormat } from './components/charts/format.ts'
export { Heatmap, type HeatmapProps } from './components/charts/Heatmap.tsx'
export type { HeatmapCell } from './components/charts/heatmap-model.ts'
export {
  AreaChart,
  type AreaChartProps,
  type LineAreaChartProps,
  LineChart,
  type LineChartProps,
} from './components/charts/LineChart.tsx'
export {
  DonutChart,
  type DonutChartProps,
  PieChart,
  type PieChartProps,
} from './components/charts/PieChart.tsx'
export type { PieChartDatum } from './components/charts/pie.ts'
export { ScatterChart, type ScatterChartProps } from './components/charts/ScatterChart.tsx'
export type { ScatterPoint, ScatterSeries } from './components/charts/scatter.ts'
export type { ChartSeries } from './components/charts/series.ts'
export {
  Checkbox,
  type CheckboxComponent,
  type CheckboxGroupProps,
  type CheckboxProps,
  type ChoiceOption,
  Radio,
  type RadioComponent,
  type RadioGroupProps,
  type RadioProps,
  Segmented,
  type SegmentedOption,
  type SegmentedProps,
  Switch,
  type SwitchProps,
} from './components/choice.tsx'
export { type CommandMatchable, matchCommands } from './components/commandMatch.ts'
export {
  DataTable,
  type DataTableColumn,
  type DataTablePin,
  type DataTableProps,
  type DataTableSort,
  type DataTableSortDirection,
} from './components/data-table/DataTable.tsx'
export {
  DatePicker,
  type DatePickerComponent,
  type DatePickerProps,
  type RangePickerProps,
  TimePicker,
  type TimePickerComponent,
  type TimePickerProps,
  type TimeRangePickerProps,
} from './components/date.tsx'
export {
  Alert,
  type AlertProps,
  Descriptions,
  type DescriptionsComponent,
  type DescriptionsItem,
  type DescriptionsItemProps,
  type DescriptionsProps,
  Divider,
  type DividerProps,
  Pagination,
  type PaginationProps,
  Skeleton,
  type SkeletonProps,
  Tabs,
  type TabsItem,
  type TabsProps,
  Timeline,
  type TimelineItem,
  type TimelineProps,
  Tree,
  type TreeDataNode,
  type TreeDropInfo,
  type TreeProps,
} from './components/display.tsx'
export {
  Avatar,
  type AvatarProps,
  IconButton,
  type IconButtonProps,
  LinkButton,
  type LinkButtonProps,
  Pill,
  type PillProps,
  type PillTone,
} from './components/Extras.tsx'
export {
  type ConfirmDangerOptions,
  EmptyState,
  type EmptyStateProps,
  ErrorState,
  type ErrorStateProps,
  Loading,
  type LoadingProps,
  PageSkeleton,
  type PageSkeletonProps,
  useConfirmDanger,
} from './components/feedback.tsx'
export {
  SegmentedBar,
  type SegmentedBarItem,
  type SegmentedBarProps,
} from './components/figures/SegmentedBar.tsx'
export { Sparkline, type SparklineProps } from './components/figures/Sparkline.tsx'
export {
  Statistic,
  type StatisticDelta,
  type StatisticProps,
} from './components/figures/Statistic.tsx'
export {
  type FieldName,
  Form,
  type FormComponent,
  type FormFieldError,
  type FormFinishFailedInfo,
  type FormInstance,
  type FormItemProps,
  type FormProps,
  type FormRule,
  type FormValues,
} from './components/form.tsx'
export { Icon, type IconName, type IconProps, iconNames, isIconName } from './components/Icon.tsx'
export {
  Image,
  type ImagePreviewOptions,
  type ImageProps,
} from './components/Image.tsx'
export { ImageGrid, type ImageGridItem, type ImageGridProps } from './components/ImageGrid.tsx'
export {
  InlineEdit,
  type InlineEditOption,
  type InlineEditProps,
  type InlineEditType,
  type InlineEditValue,
} from './components/InlineEdit.tsx'
export {
  type FocusOptions,
  Input,
  type InputComponent,
  InputNumber,
  type InputNumberProps,
  type InputNumberRef,
  type InputPasswordProps,
  type InputProps,
  type InputRef,
  type InputSearchInfo,
  type InputSearchProps,
  type InputTextAreaProps,
  type TextAreaRef,
} from './components/input.tsx'
export {
  CountBadge,
  type CountBadgeProps,
  ListItem,
  type ListItemProps,
  SettingRow,
  type SettingRowProps,
  StatusDot,
  type StatusDotProps,
} from './components/items.tsx'
export { Kbd, type KbdProps } from './components/Kbd.tsx'
export type { KeyPlatform } from './components/keys.ts'
export { Lightbox, type LightboxItem, type LightboxProps } from './components/Lightbox.tsx'
export {
  type Align,
  type BaseProps,
  Box,
  type BoxProps,
  Center,
  type CenterProps,
  Grid,
  type GridComponent,
  type GridItemProps,
  type GridProps,
  Inline,
  type InlineProps,
  type Justify,
  Spacer,
  type SpaceStep,
  Stack,
  type StackProps,
} from './components/layout.tsx'
export {
  App,
  type AppProps,
  type CloseMessage,
  type MessageApi,
  type MessageConfig,
  type MessageOptions,
  type ShowMessage,
  type UndoableMessageOptions,
  useMessage,
} from './components/message.tsx'
export {
  Breadcrumb,
  type BreadcrumbItem,
  type BreadcrumbProps,
  Steps,
  type StepsItem,
  type StepsProps,
} from './components/navigation.tsx'
export {
  Drawer,
  type DrawerProps,
  Dropdown,
  type DropdownMenu,
  type DropdownMenuAction,
  type DropdownMenuDivider,
  type DropdownMenuItem,
  type DropdownProps,
  Modal,
  type ModalProps,
  Popconfirm,
  type PopconfirmProps,
  Popover,
  type PopoverProps,
  Tooltip,
  type TooltipProps,
} from './components/overlays.tsx'
export { Progress, type ProgressProps } from './components/Progress.tsx'
export {
  Page,
  type PageBack,
  PageHeader,
  type PageHeaderProps,
  type PageProps,
  Panel,
  type PanelProps,
  Section,
  type SectionProps,
  SplitView,
  type SplitViewProps,
  Toolbar,
  type ToolbarProps,
} from './components/patterns.tsx'
export {
  AutoComplete,
  type AutoCompleteOption,
  type AutoCompleteProps,
  Cascader,
  type CascaderOption,
  type CascaderProps,
  ColorPicker,
  type ColorPickerProps,
  type ColorPreset,
  Slider,
  type SliderProps,
} from './components/pickers.tsx'
export { SelectionBar, type SelectionBarProps } from './components/SelectionBar.tsx'
export { Splitter, type SplitterProps } from './components/Splitter.tsx'
export {
  type FieldAttributes,
  Select,
  type SelectOption,
  type SelectOptionGroup,
  type SelectProps,
  type SelectRef,
  TreeSelect,
  type TreeSelectOption,
  type TreeSelectProps,
} from './components/select.tsx'
export { Text, type TextProps } from './components/Text.tsx'
export {
  Upload,
  type UploadChangeInfo,
  type UploadComponent,
  type UploadDropzoneProps,
  type UploadFile,
  type UploadFileStatus,
  type UploadProps,
  type UploadRejectReason,
  type UploadRequestOptions,
} from './components/upload.tsx'
export { type DelayedPendingOptions, useDelayedPending } from './components/useDelayedPending.ts'
export {
  HotkeysProvider,
  type HotkeysProviderProps,
  type RegisteredHotkey,
  type UseHotkeysOptions,
  useHotkeys,
  useRegisteredHotkeys,
} from './components/useHotkeys.tsx'
export {
  VirtualList,
  type VirtualListHandle,
  type VirtualListProps,
} from './components/VirtualList.tsx'
export type {
  ComponentDoc,
  ComponentDocsJson,
  ComponentExampleDoc,
  ComponentMemberDoc,
  ComponentModeDoc,
  ComponentPropDoc,
  ComponentTypeDoc,
  DocLanguage,
  DocText,
} from './docs.ts'
export {
  builtinMessages,
  enUS,
  formatMessage,
  type LocaleName,
  type MessageKey,
  type Messages,
  useT,
  zhCN,
} from './i18n/index.ts'
export {
  type CompileOptions,
  CSS_VAR_PREFIX,
  type CssVars,
  compileTheme,
  cssVar,
  type ExtendedThemeDefinition,
  extendTheme,
  resolveTheme,
  type Theme,
  type ThemeOverrides,
  toCssText,
} from './theme/compile.ts'
export {
  LocaleProvider,
  type LocaleProviderProps,
  type ThemeContextValue,
  ThemeProvider,
  type ThemeProviderProps,
  useTheme,
} from './theme/ThemeProvider.tsx'
export {
  type BuiltinThemeId,
  builtinThemes,
  type ColorModePreference,
  DEFAULT_THEME,
  defaultTheme,
  type ThemeDefinition,
} from './themes/index.ts'
export { componentTokens, type Density } from './tokens/component.ts'
export {
  contrastRatio,
  deriveStates,
  formatOklch,
  type Oklch,
  oklch,
  relativeLuminance,
  type StateColors,
  toHex,
} from './tokens/oklch.ts'
export * as primitives from './tokens/primitive.ts'
export {
  CHART_CATEGORICAL_COUNT,
  CHART_RAMP_STEPS,
  type ChartColors,
  type ColorMode,
  defaultScale,
  fontStacks,
  type SemanticColors,
  type SemanticScale,
  type ToneColors,
} from './tokens/semantic.ts'
export { type ViewerStage, viewerStages, viewerStageTokens } from './tokens/viewer-stage.ts'
