/**
 * 图标名称：只有名称，不引用图标本身。`IconName` 由这里推导，判断名称（isIconName）、列出全部名称（iconNames）
 * 都不必加载图标。名称对应的 Lucide 图标在 iconRegistry.ts 登记：新增图标时两处一起改，顺序一致
 * （test/components.test.tsx 检查两边的名称与顺序相同）。
 */

// 登记顺序；`iconNames` 按这个顺序列出
const NAMES = [
  'activity',
  'aperture',
  'archive',
  'arrow-left',
  'arrow-down',
  'arrow-right',
  'arrow-up',
  'sort',
  'at',
  'ban',
  'banknote',
  'bell',
  'bell-off',
  'book',
  'bot',
  'braces',
  'brain',
  'briefcase',
  'building',
  'calendar',
  'chart',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'alert',
  'check-circle',
  'circle-dashed',
  'x-circle',
  'approval',
  'clock',
  'code',
  'columns',
  'command',
  'contact',
  'copy',
  'enter',
  'crown',
  'database',
  'download',
  'more',
  'external-link',
  'file',
  'file-archive',
  'file-audio',
  'file-code',
  'file-image',
  'file-video',
  'eye',
  'eye-off',
  'file-text',
  'filter',
  'folder',
  'grip',
  'folder-open',
  'project',
  'handshake',
  'hard-drive',
  'hash',
  'home',
  'hourglass',
  'image',
  'images',
  'inbox',
  'info',
  'kanban',
  'key',
  'finance',
  'layers',
  'maximize',
  'dashboard',
  'grid',
  'link',
  'list',
  'loader',
  'lock',
  'logout',
  'message',
  'messages',
  'monitor',
  'move',
  'moon',
  'org',
  'package',
  'rows',
  'palette',
  'sidebar',
  'attach',
  'edit',
  'pin',
  'pin-start',
  'pin-end',
  'plus',
  'power',
  'receipt',
  'refresh',
  'reply',
  'rotate-ccw',
  'scan-search',
  'search',
  'send',
  'settings',
  'share',
  'shield',
  'smile',
  'sparkles',
  'compose',
  'star',
  'stop',
  'sun',
  'thumbs-down',
  'thumbs-up',
  'trash',
  'truck',
  'undo',
  'upload',
  'user',
  'user-minus',
  'user-plus',
  'users',
  'wallet',
  'webhook',
  'close',
  'zap',
  'zoom-in',
  'zoom-out',
] as const

/**
 * Name of a registered icon. Only the icons listed here can be used; they are Lucide icons under shorter names
 * (`trash` is Lucide's `Trash2`, `more` is `Ellipsis`). All names at runtime: `iconNames`. Props that take an
 * icon also accept an icon component instead of a name (see IconComponent).
 * @zh 已登记的图标名称。只能使用这里列出的图标；它们是 Lucide 图标，名称更短（`trash` 即 Lucide 的 `Trash2`，
 * `more` 即 `Ellipsis`）。运行时的全部名称见 `iconNames`。接受图标的属性也可以传图标组件代替名称（见 IconComponent）。
 */
export type IconName = (typeof NAMES)[number]

/**
 * Checks whether a value is the name of a registered icon, and narrows its type to `IconName`. Use it for names that
 * come from untyped data, such as a menu configuration loaded at runtime, before passing them to Icon.
 * @zh 判断一个值是否为已登记的图标名，并把它的类型收窄为 `IconName`。用于来自无类型数据的名称（如运行时加载的菜单
 * 配置），传给 Icon 之前先检查。
 * @group Utilities
 */
export function isIconName(name: unknown): name is IconName {
  // 只认登记过的名称：不能用 `in` 查对象，那样 `toString` 等继承来的属性也会被当成图标名
  return typeof name === 'string' && (NAMES as readonly string[]).includes(name)
}

/**
 * The names of all registered icons, in registration order. Use it where every icon is listed, such as an icon
 * overview or an icon picker.
 * @zh 全部已登记图标的名称，按登记顺序。用于需要列出全部图标的地方，如图标总览、图标选择器。
 * @group Utilities
 */
// 冻结：所有调用方共用同一个数组，排序或增删不能影响别处。PURE 标注让没有用到它的应用把这次调用摇树去掉
export const iconNames: readonly IconName[] = /* @__PURE__ */ Object.freeze([...NAMES])
