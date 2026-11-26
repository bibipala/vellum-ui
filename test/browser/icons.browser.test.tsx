/**
 * 图标在真实浏览器中的渲染：
 * - 名称图标（`icon="trash"`）与图标组件（`icon={Trash2}`）第一次渲染就是图标，输出与宽度都相同；
 * - 服务端输出的名称图标就是图标，注水时没有不一致，沿用服务端输出的元素。
 */
import { Trash2 } from 'lucide-react'
import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Button, Icon } from '../../src/index.ts'
import { render } from './render.tsx'

const box = (el: Element) => {
  const r = el.getBoundingClientRect()
  return [r.width, r.height]
}

describe('图标', () => {
  it('名称图标与图标组件第一次渲染就是图标，输出与按钮宽度相同', async () => {
    const byName = await render(<Button icon="trash">Delete</Button>)
    const byComponent = await render(<Button icon={Trash2}>Delete</Button>)
    const named = byName.container.querySelector('button svg.lucide-trash-2') as SVGSVGElement
    const component = byComponent.container.querySelector(
      'button svg.lucide-trash-2',
    ) as SVGSVGElement
    expect(named).not.toBeNull()
    expect(component).not.toBeNull()
    expect(named.outerHTML).toBe(component.outerHTML)
    expect(box(named)).toEqual([16, 16])
    expect(box(byName.container.querySelector('button') as Element)).toEqual(
      box(byComponent.container.querySelector('button') as Element),
    )
  })

  it('服务端输出的名称图标就是图标，注水一致', async () => {
    const ui = (
      <span>
        <Icon name="plus" size={20} label="Add" />
      </span>
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    container.innerHTML = renderToString(ui)
    const server = container.querySelector('svg') as SVGSVGElement
    expect(server.classList.contains('lucide-plus')).toBe(true)
    const errors = vi.spyOn(console, 'error')
    const root = await act(async () => hydrateRoot(container, ui))
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    // 注水沿用服务端输出的元素
    expect(container.querySelector('svg')).toBe(server)
    expect(box(server)).toEqual([20, 20])
    await act(async () => root.unmount())
    container.remove()
  })
})
