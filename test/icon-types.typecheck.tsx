/**
 * 图标属性的类型：只由 `pnpm typecheck` 检查，不运行（文件名不匹配任何测试项目）。
 *
 * - 接受图标的属性既接受名称（`icon="plus"`），也接受图标组件（`icon={Plus}`）；未登记的名称报错；
 * - 图标组件是本库自己的类型（IconComponent）：Lucide 图标满足它，自己写的 SVG 组件只要接受这些属性也满足；
 *   要求其他必填属性的组件不满足；
 * - IconName 仍是名称的字面量联合；转发 IconProps 的包装组件（`<Icon {...props} />`）照常通过。
 */
import { Plus, Trash2 } from 'lucide-react'
import {
  Avatar,
  Button,
  CommandPalette,
  ContextMenu,
  Dropdown,
  EmptyState,
  Icon,
  IconButton,
  type IconComponent,
  type IconComponentProps,
  type IconName,
  type IconProps,
  isIconName,
  LinkButton,
  Nav,
  Pill,
  PromptSuggestions,
  Segmented,
} from '../src/index.ts'

/** 自己画的 SVG 图标：接受 IconComponentProps 即可。 */
function Dot({ size, strokeWidth, color, ...rest }: IconComponentProps) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: 读屏属性（aria-hidden，或 role 与 aria-label）由 Icon 传入，在 rest 中
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke={color}
      strokeWidth={strokeWidth}
      {...rest}
    >
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

export const lucideIsIconComponent: IconComponent = Plus
export const customIsIconComponent: IconComponent = Dot
// @ts-expect-error 要求其他必填属性的组件不是图标组件
export const needsName: IconComponent = (props: { name: string }) => <span>{props.name}</span>

export const name: IconName = 'plus'
// @ts-expect-error 未登记的名称
export const unknown: IconName = 'no-such-icon'

/** 转发 IconProps 的包装组件。 */
export function Wrapped(props: IconProps) {
  return <Icon {...props} size={20} />
}

export function narrow(value: unknown) {
  return isIconName(value) ? <Icon name={value} /> : null
}

export function Accepted() {
  return (
    <>
      <Icon name="plus" />
      <Icon icon={Plus} tone="danger" />
      <Icon icon={Dot} label="Status" />
      <Button icon="plus">Add</Button>
      <Button icon={Plus}>Add</Button>
      <Button icon={Dot}>Add</Button>
      <IconButton icon="trash" label="Delete" />
      <IconButton icon={Trash2} label="Delete" />
      <LinkButton icon={Plus}>Add</LinkButton>
      <Pill icon={Plus}>New</Pill>
      <Avatar name="Robin" icon={Plus} />
      <EmptyState icon={Plus} title="No projects" />
      <Segmented
        options={[
          { value: 'a', label: 'A', icon: 'list' },
          { value: 'b', label: 'B', icon: Plus },
        ]}
      />
      <Nav
        items={[
          { key: 'home', label: 'Home', icon: 'home' },
          { key: 'new', label: 'New', icon: Plus },
        ]}
      />
      <Dropdown
        menu={{
          items: [
            { key: 'add', label: 'Add', icon: Plus },
            { key: 'delete', label: 'Delete', icon: 'trash' },
          ],
        }}
      >
        <button type="button">More</button>
      </Dropdown>
      <ContextMenu items={[{ key: 'add', label: 'Add', icon: Plus }]}>
        <div>Target</div>
      </ContextMenu>
      <CommandPalette
        open={false}
        onOpenChange={() => {}}
        items={[{ id: 'add', title: 'Add', icon: Plus }]}
      />
      <PromptSuggestions items={[{ key: 'add', label: 'Add', icon: Plus }]} />
    </>
  )
}

export function Rejected() {
  return (
    <>
      {/* @ts-expect-error 未登记的名称 */}
      <Icon name="no-such-icon" />
      {/* @ts-expect-error 同上 */}
      <Button icon="no-such-icon">Add</Button>
      {/* @ts-expect-error 同上 */}
      <IconButton icon="no-such-icon" label="Delete" />
      {/* @ts-expect-error 不是图标组件（要求必填属性） */}
      <Button icon={(props: { name: string }) => <span>{props.name}</span>}>Add</Button>
      {/* @ts-expect-error Icon 的 icon 只接受组件，名称写在 name */}
      <Icon icon="plus" />
      <Nav
        items={[
          // @ts-expect-error 未登记的名称
          { key: 'home', label: 'Home', icon: 'no-such-icon' },
        ]}
      />
    </>
  )
}
