/**
 * App 为危险确认（useConfirmDanger）提供的对话框接口：antd 的 `Modal.useModal()` 返回的接口，由 App 与渲染对话框的
 * 容器一起创建（嵌套的 App 沿用外层的）。组件库内部使用，不从入口导出。
 *
 * 不使用 antd 的 App：它同时创建 message 与 notification 两套容器，而本库的消息条是自己实现的（message.tsx）。
 */
import type { Modal } from 'antd'
import { createContext } from 'react'

/** `Modal.useModal()` 返回的接口（confirm、info 等）。 */
export type ModalApi = ReturnType<typeof Modal.useModal>[0]

export const ModalApiContext = createContext<ModalApi | null>(null)
