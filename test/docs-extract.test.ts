/**
 * The extraction of scripts/docs/ on small packages held in memory (memorySource), not on the repository: props by
 * mode, static members, native attributes inherited from a dependency, the types reached through props, callbacks and
 * hook signatures, the entry of each export, and the problems reported for missing or invalid translations.
 * test/docs.test.ts checks the whole repository once.
 */
import { describe, expect, it } from 'vitest'
import { collect } from '../scripts/docs/collect.ts'
import { memorySource } from '../scripts/docs/program.ts'

const ROOT = '/vellum-docs-fixture'

/** A package in the node_modules of the fixture (named here: the fixture imports it, the tests do not). */
const DEPENDENCY = 'native-attrs'

/** Stands in for the DOM attribute interfaces of React: declared in a dependency, so they are not listed. */
const NATIVE = `
export interface HTMLAttributes {
  id?: string
  onClick?: () => void
}
export interface ButtonHTMLAttributes extends HTMLAttributes {
  disabled?: boolean
}
export interface InputHTMLAttributes extends HTMLAttributes {
  placeholder?: string
  onChange?: () => void
}
`

const INDEX = `
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from '${DEPENDENCY}'

/** Props shared by the primitives. */
interface BaseProps {
  /** Test id. */
  readonly testId?: string
}

/**
 * Visual weight of Press.
 * @zh Press 的视觉权重。
 */
export type PressVariant = 'plain' | 'primary'

interface PressOwnProps {
  /**
   * Visual weight.
   * @zh 视觉权重。
   * @default 'plain'
   */
  readonly variant?: PressVariant
  /** Kept for internal use; not documented. */
  readonly className?: string
}

/** The base interface comes before the more specific one, so the first owner met is not the one to name. */
export interface PressProps extends PressOwnProps, BaseProps, HTMLAttributes, ButtonHTMLAttributes {}

/**
 * A button to press.
 * @zh 可以按下的按钮。
 * @category Basic
 * @usage Main actions
 * @usageZh 主要操作
 */
export function Press(props: PressProps) {
  return props.variant ?? null
}

/**
 * An option of Choice.
 * @zh Choice 的选项。
 */
export interface ChoiceOption {
  /**
   * Value of the option.
   * @zh 选项的值。
   */
  readonly value: string
}

interface ChoiceCommonProps {
  /**
   * Options to choose from.
   * @zh 可选的项。
   */
  readonly options: readonly ChoiceOption[]
}

/**
 * Single choice (default)
 * One value at a time.
 * @zh 单选（默认）
 * 一次一个值。
 */
interface ChoiceSingleProps extends ChoiceCommonProps {
  /**
   * Allows several values.
   * @zh 允许选择多个值。
   */
  readonly multiple?: false
  /**
   * Called with the chosen value.
   * @zh 选中时调用，参数是选中的值。
   */
  readonly onChange?: (value: string) => void
}

/**
 * Multiple choice: \`multiple\`
 * @zh 多选：\`multiple\`
 */
interface ChoiceMultipleProps extends ChoiceCommonProps {
  /**
   * Allows several values.
   * @zh 允许选择多个值。
   */
  readonly multiple: true
  /**
   * Called with the chosen values.
   * @zh 选中时调用，参数是选中的全部值。
   */
  readonly onChange?: (value: string[]) => void
}

/** Props of Choice, normalized by TypeScript to (Single & Native) | (Multiple & Native). */
export type ChoiceProps = (ChoiceSingleProps | ChoiceMultipleProps) &
  Omit<InputHTMLAttributes, 'onChange'>

/**
 * Chooses one or several values.
 * @zh 选择一个或多个值。
 * @category Data
 * @usage Filters
 * @usageZh 筛选
 */
export function Choice(props: ChoiceProps) {
  return props.options.length
}

/**
 * A validation rule.
 * @zh 校验规则。
 */
export interface FormRule {
  /**
   * Whether a value is required.
   * @zh 是否必填。
   */
  readonly required?: boolean
}

/**
 * The values of a form.
 * @zh 表单的值。
 */
export interface FormInstance<V> {
  /**
   * Current values.
   * @zh 当前的值。
   */
  readonly values: V
}

export interface FormProps {
  /**
   * Called on submit.
   * @zh 提交时调用。
   */
  readonly onSubmit?: () => void
}

export interface FormItemProps {
  /**
   * Label of the field.
   * @zh 字段的标签。
   */
  readonly label: string
  /**
   * Validation rules.
   * @zh 校验规则。
   */
  readonly rules?: readonly FormRule[]
}

export interface FormComponent {
  /**
   * Renders a form.
   * @zh 渲染表单。
   */
  (props: FormProps): null
  /**
   * One field of the form.
   * @zh 表单中的一个字段。
   */
  readonly Item: (props: FormItemProps) => null
  /**
   * Creates a form instance.
   * @zh 创建表单实例。
   */
  readonly useForm: <V>() => [FormInstance<V>]
}

/**
 * A form.
 * @zh 表单。
 * @category Data
 * @usage Settings
 * @usageZh 设置
 */
export const Form: FormComponent = Object.assign((_: FormProps) => null, {
  Item: (_: FormItemProps) => null,
  useForm: <V>() => [{ values: {} as V }] as [FormInstance<V>],
})

/**
 * A tag of a picked item.
 * @zh 已选项的标签。
 */
export interface PickerTag {
  /**
   * Text of the tag.
   * @zh 标签的文字。
   */
  readonly text: string
}

/**
 * A picked item.
 * @zh 已选的项。
 */
export interface PickedItem {
  /**
   * Identifier.
   * @zh 标识。
   */
  readonly id: string
  /**
   * Tags of the item.
   * @zh 这一项的标签。
   */
  readonly tags: readonly PickerTag[]
}

/**
 * How an item was picked.
 * @zh 选取的方式。
 */
export type PickReason = 'click' | 'keyboard'

const PICKER_ICONS = { check: 1, star: 2 }

/**
 * Icon of a picker.
 * @zh 选择器的图标。
 */
export type PickerIcon = keyof typeof PICKER_ICONS

interface PickerInternal {
  readonly secret: number
}

export interface PickerProps {
  /**
   * Called when an item is picked.
   * @zh 选取一项时调用。
   */
  readonly onPick?: (item: PickedItem, reason: PickReason) => void
  /**
   * Renders an item.
   * @zh 渲染一项。
   */
  readonly renderItem?: (item: PickedItem) => PickerInternal
  /**
   * Icon shown before the items.
   * @zh 显示在各项前面的图标。
   */
  readonly icon?: PickerIcon
}

/**
 * Picks items from a list.
 * @zh 从列表中选取项。
 * @category Data
 * @usage Lists
 * @usageZh 列表
 */
export function Picker(props: PickerProps) {
  return props.icon ?? null
}

export interface UsePickerOptions {
  /**
   * Identifiers picked at first.
   * @zh 初始选中的标识。
   */
  readonly initial?: readonly string[]
}

/**
 * State returned by usePicker.
 * @zh usePicker 返回的状态。
 */
export interface PickerState {
  /**
   * Picked items.
   * @zh 已选的项。
   */
  readonly picked: readonly PickedItem[]
}

/**
 * Keeps the picked items.
 * @zh 保存已选的项。
 * @category Data
 * @usage Lists
 * @usageZh 列表
 */
export function usePicker(options: UsePickerOptions = {}): PickerState {
  return { picked: options.initial ? [] : [] }
}
`

const CHARTS = `
import type { PickerTag } from './index.ts'

export interface GaugeProps {
  /**
   * Value from 0 to 1.
   * @zh 0 到 1 之间的值。
   */
  readonly value: number
  /**
   * Tag shown below the value.
   * @zh 显示在值下方的标签。
   */
  readonly tag?: PickerTag
}

/**
 * A gauge.
 * @zh 仪表。
 * @category Charts
 * @usage Dashboards
 * @usageZh 仪表盘
 */
export function Gauge(props: GaugeProps) {
  return props.value
}
`

/** An example file with one "Basic usage" example. */
const example = (description = '') => `
/**
 * Basic usage${description ? `\n * ${description}` : ''}
 * @zh 基本用法
 */
export function Basic() {
  return null
}
`

const FILES: Readonly<Record<string, string>> = {
  'src/index.ts': INDEX,
  'src/charts.ts': CHARTS,
  'src/ai.ts': 'export {}\n',
  [`node_modules/${DEPENDENCY}/index.d.ts`]: NATIVE,
  ...Object.fromEntries(
    ['Press', 'Choice', 'Form', 'Picker', 'usePicker', 'Gauge'].map((n) => [
      `examples/${n}.examples.tsx`,
      example(),
    ]),
  ),
}

const extract = (files: Readonly<Record<string, string>> = FILES) =>
  collect(memorySource(ROOT, files))

/** The fixture with one text replaced (the replacement must apply). */
function changed(file: string, from: string, to: string): Record<string, string> {
  const text = FILES[file] ?? ''
  if (!text.includes(from)) throw new Error(`${file} does not contain ${from}`)
  return { ...FILES, [file]: text.replace(from, to) }
}

describe('documentation extraction (fixtures in memory)', () => {
  const { components, problems } = extract()
  const byName = (name: string) => {
    const c = components.find((x) => x.name === name)
    if (!c) throw new Error(`no documentation for ${name}`)
    return c
  }
  const names = (list: readonly { name: string }[]) => list.map((x) => x.name)

  it('a complete fixture has no problems; components are ordered by category, then by name', () => {
    expect(problems).toEqual([])
    expect(names(components)).toEqual(['Press', 'Choice', 'Form', 'Picker', 'usePicker', 'Gauge'])
  })

  it('union modes: shared props in the main table, the others per mode, titled by the member TSDoc', () => {
    const choice = byName('Choice')
    expect(names(choice.props)).toEqual(['options'])
    expect(choice.props[0]?.type).toBe('readonly ChoiceOption[]')
    expect(
      choice.modes.map((m) => ({
        title: m.title,
        description: m.description,
        props: m.props.map((p) => [p.name, p.type, p.required]),
      })),
    ).toEqual([
      {
        title: { en: 'Single choice (default)', zh: '单选（默认）' },
        description: { en: 'One value at a time.', zh: '一次一个值。' },
        props: [
          ['multiple', 'false', false],
          ['onChange', '(value: string) => void', false],
        ],
      },
      {
        title: { en: 'Multiple choice: `multiple`', zh: '多选：`multiple`' },
        description: { en: '', zh: '' },
        props: [
          ['multiple', 'true', true],
          ['onChange', '(value: string[]) => void', false],
        ],
      },
    ])
    // The intersection with native attributes still splits into modes, and names the attribute interface
    expect(choice.native).toBe('InputHTMLAttributes')
  })

  it('static members: a sub-component gets a props table, a function member its signature', () => {
    const form = byName('Form')
    expect(names(form.props)).toEqual(['onSubmit'])
    expect(
      form.members.map((m) => ({
        name: m.name,
        summary: m.summary,
        signature: m.signature,
        props: names(m.props),
      })),
    ).toEqual([
      {
        name: 'Form.Item',
        summary: { en: 'One field of the form.', zh: '表单中的一个字段。' },
        signature: null,
        props: ['label', 'rules'],
      },
      {
        name: 'Form.useForm',
        summary: { en: 'Creates a form instance.', zh: '创建表单实例。' },
        signature: 'Form.useForm<V>(): [FormInstance<V>]',
        props: [],
      },
    ])
    // The props interfaces of the component and of its members are not listed again as types
    expect(names(form.types)).toEqual(['FormRule', 'FormInstance<V>'])
  })

  it('inherited native props: not listed, the most specific attribute interface is named', () => {
    const press = byName('Press')
    expect(press.props).toEqual([
      {
        name: 'variant',
        // A literal alias used as the type of a prop is expanded, and not listed among the types
        type: "'plain' | 'primary'",
        description: { en: 'Visual weight.', zh: '视觉权重。' },
        default: "'plain'",
        required: false,
      },
    ])
    expect(press.native).toBe('ButtonHTMLAttributes')
    expect(press.base).toBe(true)
    expect(press.types).toEqual([])
    expect(press.members).toEqual([])
  })

  it('callbacks and signatures: referenced types are listed, recursively, and only exported ones', () => {
    const picker = byName('Picker')
    expect(picker.props.map((p) => [p.name, p.type])).toEqual([
      ['onPick', '(item: PickedItem, reason: PickReason) => void'],
      ['renderItem', '(item: PickedItem) => PickerInternal'],
      ['icon', 'PickerIcon'],
    ])
    expect(
      picker.types.map((t) => ({
        name: t.name,
        definition: t.definition,
        values: t.values,
        fields: names(t.fields),
      })),
    ).toEqual([
      { name: 'PickedItem', definition: null, values: [], fields: ['id', 'tags'] },
      // A literal alias reached through a callback parameter is listed with its definition
      {
        name: 'PickReason',
        definition: "type PickReason = 'click' | 'keyboard'",
        values: [],
        fields: [],
      },
      // An alias that resolves to literals (keyof typeof) lists the values instead of the definition
      { name: 'PickerIcon', definition: null, values: ['"check"', '"star"'], fields: [] },
      { name: 'PickerTag', definition: null, values: [], fields: ['text'] },
    ])
    const hook = byName('usePicker')
    expect(hook.signature).toBe('usePicker(options?: UsePickerOptions): PickerState')
    expect(names(hook.props)).toEqual(['initial'])
    expect(names(hook.types)).toEqual(['PickerState', 'PickedItem', 'PickerTag'])
  })

  it('each component and each type records the entry that exports it', () => {
    const gauge = byName('Gauge')
    expect(gauge.entry).toBe('vellum-ui/charts')
    expect(gauge.types.map((t) => [t.name, t.entry])).toEqual([['PickerTag', 'vellum-ui']])
    expect(byName('Press').entry).toBe('vellum-ui')
  })

  it.each([
    [
      'a prop without @zh',
      changed('src/index.ts', '   * @zh 视觉权重。\n', ''),
      ['Press.variant 属性说明: 缺少 @zh 中文'],
    ],
    [
      '@zh without Chinese',
      changed('src/index.ts', '@zh 视觉权重。', '@zh Visual weight.'),
      ['Press.variant 属性说明: @zh 中没有中文'],
    ],
    [
      'Chinese in the English text',
      changed('src/index.ts', 'Picks items from a list.', 'Picks items（选取）from a list.'),
      ['Picker 组件说明: 英文正文中有中文或全角标点'],
    ],
    [
      'a mode title without @zh',
      changed('src/index.ts', ' * @zh 多选：`multiple`\n', ''),
      ['Choice 的用法 2（属性联合中一员的 TSDoc 第一行）: 缺少 @zh 中文'],
    ],
    [
      'a field of a referenced type without @zh',
      changed('src/index.ts', '   * @zh 标识。\n', ''),
      // Reported on every page that lists the type
      [
        'Picker 引用的类型 PickedItem.id 字段说明: 缺少 @zh 中文',
        'usePicker 引用的类型 PickedItem.id 字段说明: 缺少 @zh 中文',
      ],
    ],
    [
      'an example description in one language only',
      { ...FILES, 'examples/Gauge.examples.tsx': example('Shows a value.') },
      ['Gauge 示例 Basic 的说明: 缺少 @zh 中文'],
    ],
  ])('reports %s', (_, files, expected) => {
    expect(extract(files).problems).toEqual(expected)
  })
})
