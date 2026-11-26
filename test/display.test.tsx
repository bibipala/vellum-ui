import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// 展示组件的属性由本库声明（ADR 0021），在内部换成 antd 的属性。服务端渲染测不到交互，
// 这里替换 antd 的 Tree、Alert、Steps，只检查换算的结果；交互见 test/browser 中的测试。
// Divider、Timeline、Descriptions 是原生标记，这里检查服务端渲染的结构与语义。
const received = vi.hoisted(() => ({
  tree: [] as unknown[],
  alert: [] as unknown[],
  steps: [] as unknown[],
}))
vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>()
  const record = (list: unknown[]) => (props: object) => {
    list.push(props)
    return null
  }
  return {
    ...actual,
    Tree: record(received.tree),
    Alert: record(received.alert),
    Steps: record(received.steps),
  }
})

const { Alert, Descriptions, Divider, Steps, Timeline, Tree } = await import('../src/index.ts')

type AntDropInfo = {
  dragNode: { key: string }
  node: { key: string; pos: string }
  dropPosition: number
  dropToGap: boolean
}
type AntTreeProps = Record<string, unknown> & {
  treeData: { key: string; children?: unknown[] }[]
  onExpand?: (keys: (string | number)[]) => void
  onDrop?: (info: AntDropInfo) => void
}

describe('Tree', () => {
  const treeData = [
    {
      key: 'eng',
      title: 'Engineering',
      sort: 1,
      children: [
        { key: 'fe', title: 'Frontend', sort: 1 },
        { key: 'be', title: 'Backend', sort: 2 },
      ],
    },
    { key: 'ops', title: 'Operations', sort: 2 },
  ]

  it('没给出的受控 key 不传给 antd（rc-tree 按属性是否存在判断受控），节点只带列出的字段', () => {
    received.tree.length = 0
    renderToStaticMarkup(<Tree options={treeData} defaultSelectedKeys={['fe']} />)
    const props = received.tree.at(-1) as AntTreeProps
    for (const name of ['expandedKeys', 'selectedKeys', 'checkedKeys', 'defaultCheckedKeys'])
      expect(Object.hasOwn(props, name), name).toBe(false)
    expect(props.defaultSelectedKeys).toEqual(['fe'])
    expect(props.treeData[0]).toEqual({
      key: 'eng',
      title: 'Engineering',
      disabled: undefined,
      children: [
        { key: 'fe', title: 'Frontend', disabled: undefined, children: undefined },
        { key: 'be', title: 'Backend', disabled: undefined, children: undefined },
      ],
    })
    // 拖动不显示 antd 的手柄图标
    expect(props.draggable).toBe(false)
  })

  it('回调收到字符串 key；onDrop 收到原来的节点对象与位置（之前、之内、之后）', () => {
    received.tree.length = 0
    const onExpand = vi.fn()
    const onDrop = vi.fn()
    renderToStaticMarkup(
      <Tree options={treeData} draggable onExpand={onExpand} onDrop={onDrop} testId="tree" />,
    )
    const props = received.tree.at(-1) as AntTreeProps
    expect(props.draggable).toEqual({ icon: false })
    expect(props['data-testid']).toBe('tree')
    props.onExpand?.(['eng', 3])
    expect(onExpand).toHaveBeenCalledWith(['eng', '3'])
    // 目标 be 在同级中的序号是 1（pos 0-0-1）：dropPosition 0 = 之前，2 = 之后；不在缝隙中 = 之内
    const drop = (dropPosition: number, dropToGap: boolean) =>
      props.onDrop?.({
        dragNode: { key: 'ops' },
        node: { key: 'be', pos: '0-0-1' },
        dropPosition,
        dropToGap,
      })
    drop(0, true)
    drop(1, false)
    drop(2, true)
    const ops = treeData[1]
    const be = treeData[0]?.children?.[1]
    expect(onDrop.mock.calls.map(([info]) => info)).toEqual([
      { node: ops, target: be, position: 'before' },
      { node: ops, target: be, position: 'inside' },
      { node: ops, target: be, position: 'after' },
    ])
    // 原来的对象（带调用方自己的字段），不是副本
    expect(onDrop.mock.calls[0]?.[0].node).toBe(ops)
  })
})

describe('Alert', () => {
  it('tone 换成 antd 的 type（danger → error）；closable 与 onClose 合成 antd 的 closable', () => {
    received.alert.length = 0
    const onClose = vi.fn()
    renderToStaticMarkup(<Alert tone="danger" title="Failed" closable onClose={onClose} />)
    renderToStaticMarkup(<Alert title="Note" />)
    const [danger, plain] = received.alert as {
      type?: string
      closable?: { onClose?: () => void }
    }[]
    expect(danger?.type).toBe('error')
    danger?.closable?.onClose?.()
    expect(onClose).toHaveBeenCalledOnce()
    expect(plain?.type).toBe('info')
    expect(plain?.closable).toBeUndefined()
  })
})

describe('Timeline', () => {
  it('原生有序列表：每个事件一个 li，tone 默认 accent，key 默认取位置', () => {
    const html = renderToStaticMarkup(
      <Timeline
        items={[
          { content: 'a' },
          { content: 'b', tone: 'neutral' },
          { content: 'c', tone: 'danger', key: 'last' },
        ]}
      />,
    )
    expect(html).toMatch(/^<ol class="[^"]+">/)
    expect(html).not.toContain('ant-')
    expect([...html.matchAll(/<li [^>]*data-tone="(\w+)"/g)].map((m) => m[1])).toEqual([
      'accent',
      'neutral',
      'danger',
    ])
    expect([...html.matchAll(/<div class="[^"]+">(\w)<\/div>/g)].map((m) => m[1])).toEqual([
      'a',
      'b',
      'c',
    ])
  })
})

describe('Divider', () => {
  it('没有文字时是 hr；带文字时是以文字为名称的 separator（子元素对读屏是表现性的）', () => {
    expect(renderToStaticMarkup(<Divider />)).toMatch(/^<hr class="[^"]+"\/>$/)
    for (const empty of [null, false, ''])
      expect(renderToStaticMarkup(<Divider>{empty}</Divider>)).toMatch(/^<hr /)
    const html = renderToStaticMarkup(<Divider plain>November 4</Divider>)
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1]
    expect(html).toMatch(/^<div role="separator"/)
    expect(html).toContain('data-plain=""')
    expect(labelledBy).toBeTruthy()
    expect(html).toContain(`<span id="${labelledBy}" class="`)
    expect(html).toContain('>November 4</span>')
    expect(renderToStaticMarkup(<Divider>Today</Divider>)).not.toContain('data-plain')
  })
})

describe('Descriptions', () => {
  const items = [
    { key: 'a', label: 'Name', children: 'Alex Morgan' },
    { key: 'b', label: 'Team', children: 'Design' },
    { label: 'Status', children: 'Active' },
  ]

  it('原生描述列表：每个字段一组 dt / dd，包在 div 中', () => {
    const html = renderToStaticMarkup(<Descriptions items={items} size="sm" />)
    expect(html).toMatch(/^<dl class="[^"]+" data-size="sm" data-responsive="">/)
    expect(html).not.toContain('ant-')
    expect(
      html.match(
        /<div class="[^"]+"><dt class="[^"]+">\w+<\/dt><dd class="[^"]+">[\w ]+<\/dd><\/div>/g,
      ),
    ).toHaveLength(3)
  })

  it('指定列数：写入列数，最后一行排不满时最后一个字段占满余下的列', () => {
    const two = renderToStaticMarkup(<Descriptions items={items} column={2} />)
    expect(two).toContain('style="--descriptions-columns:2"')
    expect(two).not.toContain('data-responsive')
    expect(two.match(/grid-column:span \d/g)).toEqual(['grid-column:span 2'])
    const four = renderToStaticMarkup(<Descriptions items={items} column={4} />)
    expect(four.match(/grid-column:span \d/g)).toEqual(['grid-column:span 2'])
    // 正好排满：不占满
    expect(renderToStaticMarkup(<Descriptions items={items} column={3} />)).not.toContain(
      'grid-column',
    )
    expect(renderToStaticMarkup(<Descriptions items={items} column={1} />)).not.toContain(
      'grid-column',
    )
  })
})

describe('Steps', () => {
  it('当前步骤带 aria-current，size="sm" 换成 antd 的 small', () => {
    received.steps.length = 0
    renderToStaticMarkup(
      <Steps current={1} size="sm" items={[{ title: 'A' }, { title: 'B' }, { title: 'C' }]} />,
    )
    const props = received.steps.at(-1) as { size?: string; items: Record<string, unknown>[] }
    expect(props.size).toBe('small')
    expect(props.items.map((i) => i['aria-current'])).toEqual([undefined, 'step', undefined])
  })
})
