/**
 * 图标的渲染（服务端渲染，不访问 DOM）：
 * - 名称表与注册表一一对应，顺序相同（`iconNames` 按登记顺序）；
 * - 图标组件经本库渲染的输出，与原来按名称渲染的 Icon（Lucide 组件加 absoluteStrokeWidth）逐字节相同；
 * - 名称图标在服务端渲染时就是图标，与传图标组件的输出相同；
 * - Icon 既没有 `name` 也没有 `icon` 时留出同样大小的空 `<svg>`。
 */
import { type LucideIcon, Plus, Trash2 } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { registry } from '../src/components/iconRegistry.ts'
import {
  Avatar,
  Button,
  Icon,
  IconButton,
  type IconProps,
  iconNames,
  LinkButton,
  Pill,
} from '../src/index.ts'

const TONE_COLOR: Record<NonNullable<IconProps['tone']>, string> = {
  inherit: 'currentColor',
  secondary: 'var(--vl-color-text-secondary)',
  tertiary: 'var(--vl-color-text-tertiary)',
  accent: 'var(--vl-color-accent-text)',
  danger: 'var(--vl-color-danger)',
  success: 'var(--vl-color-success)',
  warning: 'var(--vl-color-warning)',
}

/** 原来的 Icon（1.7）怎样渲染一个 Lucide 组件：逐个属性照抄，作为对照。 */
function before(
  C: LucideIcon,
  { size = 16, strokeWidth = 1.75, tone = 'inherit', label }: Omit<IconProps, 'name' | 'icon'>,
) {
  return renderToStaticMarkup(
    <C
      size={size}
      strokeWidth={strokeWidth}
      color={TONE_COLOR[tone]}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      absoluteStrokeWidth
    />,
  )
}

describe('名称表与注册表', () => {
  it('一一对应，顺序相同', () => {
    expect(Object.keys(registry)).toEqual([...iconNames])
    expect(new Set(iconNames).size).toBe(iconNames.length)
  })
})

describe('图标组件的输出与原来的 Icon 相同', () => {
  it('每一个登记的图标、各种尺寸、线宽、色调与读屏名称', () => {
    const variants: Omit<IconProps, 'name' | 'icon'>[] = [
      {},
      { size: 12 },
      { size: 14, tone: 'tertiary' },
      { size: 18, tone: 'danger' },
      { size: 20, strokeWidth: 1.5 },
      { size: 24, tone: 'success', label: 'Done' },
      { size: Math.round(32 * 0.48), tone: 'accent' },
    ]
    let compared = 0
    for (const C of Object.values(registry))
      for (const v of variants) {
        // 注册表中都是 Lucide 图标
        expect(renderToStaticMarkup(<Icon icon={C} {...v} />)).toBe(before(C as LucideIcon, v))
        compared++
      }
    expect(compared).toBe(iconNames.length * variants.length)
  })
})

describe('名称图标（服务端渲染）', () => {
  it('与传图标组件的输出相同', () => {
    const pairs = [
      [<Icon key="n" name="plus" size={14} />, <Icon key="c" icon={Plus} size={14} />],
      [<Icon key="n" name="trash" label="Delete" />, <Icon key="c" icon={Trash2} label="Delete" />],
      [
        <Button key="n" icon="plus">
          Add
        </Button>,
        <Button key="c" icon={Plus}>
          Add
        </Button>,
      ],
      [
        <IconButton key="n" icon="trash" label="Delete" tooltip={false} />,
        <IconButton key="c" icon={Trash2} label="Delete" tooltip={false} />,
      ],
      [
        <LinkButton key="n" icon="plus">
          Add
        </LinkButton>,
        <LinkButton key="c" icon={Plus}>
          Add
        </LinkButton>,
      ],
      [
        <Pill key="n" icon="plus">
          New
        </Pill>,
        <Pill key="c" icon={Plus}>
          New
        </Pill>,
      ],
      [<Avatar key="n" name="Robin" icon="plus" />, <Avatar key="c" name="Robin" icon={Plus} />],
    ] as const
    for (const [byName, byComponent] of pairs) {
      const html = renderToStaticMarkup(byName)
      expect(html).toContain('lucide-')
      expect(html).toBe(renderToStaticMarkup(byComponent))
    }
  })

  it('name 与 icon 都没给时留出同样大小的空位', () => {
    expect(renderToStaticMarkup(<Icon size={18} />)).toBe(
      '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"></svg>',
    )
  })
})
