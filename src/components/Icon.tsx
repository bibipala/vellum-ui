/**
 * 图标：统一使用 Lucide（ISC 许可）的线性图标，线宽一致。
 * 使用方按名称引用（如菜单 `icon: 'files'`），不直接依赖图标库；这里只收录常用的图标，
 * 以免包体积随整套图标膨胀。需要新图标时在此登记。
 */
import {
  Activity,
  Aperture,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
  ArrowUp,
  ArrowUpDown,
  AtSign,
  Ban,
  Banknote,
  Bell,
  BellOff,
  BookOpen,
  Bot,
  Braces,
  Brain,
  Briefcase,
  Building2,
  Calendar,
  ChartColumn,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  ClipboardCheck,
  Clock,
  Code,
  Columns3,
  Command,
  Contact,
  Copy,
  CornerDownLeft,
  Crown,
  Database,
  Download,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Filter,
  Folder,
  FolderKanban,
  FolderOpen,
  GripVertical,
  Handshake,
  HardDrive,
  Hash,
  Hourglass,
  House,
  Image,
  Images,
  Inbox,
  Info,
  Kanban,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Link,
  List,
  LoaderCircle,
  Lock,
  LogOut,
  type LucideIcon,
  MessageSquare,
  MessagesSquare,
  Monitor,
  Moon,
  Move,
  Network,
  Package,
  Palette,
  PanelLeft,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Power,
  Receipt,
  RefreshCw,
  Reply,
  RotateCcw,
  Rows3,
  ScanSearch,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Smile,
  Sparkles,
  Square,
  SquarePen,
  Star,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Truck,
  Undo2,
  Upload,
  User,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  Webhook,
  X,
  Zap,
} from 'lucide-react'

const registry = {
  activity: Activity,
  aperture: Aperture,
  archive: Archive,
  'arrow-left': ArrowLeft,
  'arrow-down': ArrowDown,
  'arrow-right': ArrowRight,
  'arrow-up': ArrowUp,
  sort: ArrowUpDown,
  at: AtSign,
  ban: Ban,
  banknote: Banknote,
  bell: Bell,
  'bell-off': BellOff,
  book: BookOpen,
  bot: Bot,
  braces: Braces,
  brain: Brain,
  briefcase: Briefcase,
  building: Building2,
  calendar: Calendar,
  chart: ChartColumn,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  alert: CircleAlert,
  'check-circle': CircleCheck,
  'circle-dashed': CircleDashed,
  'x-circle': CircleX,
  approval: ClipboardCheck,
  clock: Clock,
  code: Code,
  columns: Columns3,
  command: Command,
  contact: Contact,
  copy: Copy,
  enter: CornerDownLeft,
  crown: Crown,
  database: Database,
  download: Download,
  more: Ellipsis,
  'external-link': ExternalLink,
  'file-image': FileImage,
  eye: Eye,
  'eye-off': EyeOff,
  'file-text': FileText,
  filter: Filter,
  folder: Folder,
  grip: GripVertical,
  'folder-open': FolderOpen,
  project: FolderKanban,
  handshake: Handshake,
  'hard-drive': HardDrive,
  hash: Hash,
  home: House,
  hourglass: Hourglass,
  image: Image,
  images: Images,
  inbox: Inbox,
  info: Info,
  kanban: Kanban,
  key: KeyRound,
  finance: Landmark,
  layers: Layers,
  dashboard: LayoutDashboard,
  grid: LayoutGrid,
  link: Link,
  list: List,
  loader: LoaderCircle,
  lock: Lock,
  logout: LogOut,
  message: MessageSquare,
  messages: MessagesSquare,
  monitor: Monitor,
  move: Move,
  moon: Moon,
  org: Network,
  package: Package,
  rows: Rows3,
  palette: Palette,
  sidebar: PanelLeft,
  attach: Paperclip,
  edit: Pencil,
  pin: Pin,
  // 固定到开头 / 结尾（DataTable 的列设置）
  'pin-start': ArrowLeftToLine,
  'pin-end': ArrowRightToLine,
  plus: Plus,
  power: Power,
  receipt: Receipt,
  refresh: RefreshCw,
  reply: Reply,
  'rotate-ccw': RotateCcw,
  'scan-search': ScanSearch,
  search: Search,
  send: Send,
  settings: Settings,
  share: Share2,
  shield: ShieldCheck,
  smile: Smile,
  sparkles: Sparkles,
  compose: SquarePen,
  star: Star,
  stop: Square,
  sun: Sun,
  'thumbs-down': ThumbsDown,
  'thumbs-up': ThumbsUp,
  trash: Trash2,
  truck: Truck,
  undo: Undo2,
  upload: Upload,
  user: User,
  'user-minus': UserMinus,
  'user-plus': UserPlus,
  users: Users,
  wallet: Wallet,
  webhook: Webhook,
  close: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>

/**
 * Name of a registered icon. Only the icons listed here can be used; they are Lucide icons under shorter names
 * (`trash` is Lucide's `Trash2`, `more` is `Ellipsis`). All names at runtime: `iconNames`.
 * @zh 已登记的图标名称。只能使用这里列出的图标；它们是 Lucide 图标，名称更短（`trash` 即 Lucide 的 `Trash2`，
 * `more` 即 `Ellipsis`）。运行时的全部名称见 `iconNames`。
 */
export type IconName = keyof typeof registry

/**
 * Checks whether a value is the name of a registered icon, and narrows its type to `IconName`. Use it for names that
 * come from untyped data, such as a menu configuration loaded at runtime, before passing them to Icon.
 * @zh 判断一个值是否为已登记的图标名，并把它的类型收窄为 `IconName`。用于来自无类型数据的名称（如运行时加载的菜单
 * 配置），传给 Icon 之前先检查。
 * @group Utilities
 */
export function isIconName(name: unknown): name is IconName {
  // 只认注册表自己的键：`in` 会把 `toString` 等继承来的属性也当成图标名
  return typeof name === 'string' && Object.hasOwn(registry, name)
}

/**
 * Props of Icon.
 * @zh Icon 属性。
 */
export interface IconProps {
  /**
   * Icon name, see `iconNames` (only registered icons can be used).
   * @zh 图标名称，见 `iconNames`（只能使用登记过的图标）。
   */
  readonly name: IconName
  /**
   * Size in pixels, 16 by default.
   * @zh 像素尺寸，默认 16。
   */
  readonly size?: number
  /**
   * Stroke width, 1.75 by default (thin but crisp).
   * @zh 线宽，默认 1.75（细而清晰）。
   */
  readonly strokeWidth?: number
  /**
   * Color: `inherit` follows the text color (default); the others are semantic colors. State colors such as hover
   * and selected are controlled by the surrounding element.
   * @zh 颜色：inherit 跟随文字颜色（默认）；其余为语义色。悬停、选中等状态色由外层元素控制。
   * @default 'inherit'
   */
  readonly tone?: 'inherit' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success' | 'warning'
  /**
   * Text label for meaningful icons; omit it for purely decorative icons (hidden from screen readers).
   * @zh 有含义的图标需要文字说明；纯装饰图标省略（对读屏隐藏）。
   */
  readonly label?: string
}

/** 默认像素尺寸。组件库内部使用（如 Button 加载时让加载指示与图标一样大），不从入口导出。 */
export const ICON_DEFAULT_SIZE = 16

const TONE: Record<NonNullable<IconProps['tone']>, string | undefined> = {
  inherit: undefined,
  secondary: 'var(--vl-color-text-secondary)',
  tertiary: 'var(--vl-color-text-tertiary)',
  accent: 'var(--vl-color-accent-text)',
  danger: 'var(--vl-color-danger)',
  success: 'var(--vl-color-success)',
  warning: 'var(--vl-color-warning)',
}

/**
 * A line icon (Lucide), referenced by name, with a consistent stroke width.
 * @zh 线性图标（Lucide），按名称引用，线宽统一。
 * @category Basic
 * @usage Icons in buttons, list items, menus and empty states; the `icon` field of menu items uses the same names
 * @usageZh 按钮、列表行、菜单、空状态中的图标；菜单配置的 `icon` 字段用同一套名称
 */

export function Icon({
  name,
  size = ICON_DEFAULT_SIZE,
  strokeWidth = 1.75,
  tone = 'inherit',
  label,
}: IconProps) {
  const C = registry[name]
  return (
    <C
      size={size}
      strokeWidth={strokeWidth}
      color={TONE[tone] ?? 'currentColor'}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      absoluteStrokeWidth
    />
  )
}

/**
 * The names of all registered icons, in registration order. Use it where every icon is listed, such as an icon
 * overview or an icon picker.
 * @zh 全部已登记图标的名称，按登记顺序。用于需要列出全部图标的地方，如图标总览、图标选择器。
 * @group Utilities
 */
// 冻结：所有调用方共用同一个数组，排序或增删不能影响别处
export const iconNames: readonly IconName[] = Object.freeze(Object.keys(registry) as IconName[])
