import { useState } from 'react'
import { App, Button, Inline, Text, useMessage } from 'vellum-ui'

function SaveButtons() {
  const message = useMessage()
  return (
    <Inline>
      <Button type="primary" onClick={() => message.success('Saved')}>
        Save
      </Button>
      <Button onClick={() => message.error('Could not save: the name is already taken')}>
        Simulate a failure
      </Button>
    </Inline>
  )
}

/**
 * Basic usage
 * Short feedback on the result of an action: slides in at the bottom center of the screen, at most 3 at a time
 * (the newest at the bottom), disappears after 4 seconds by default, and the timer pauses on hover.
 * Must be used inside App.
 * @zh 基本用法
 * 操作结果的短提示：从屏幕底部居中滑入，最多同时显示 3 条（新的在下），默认 4 秒后消失，悬停时暂停计时。
 * 必须在 App 之内使用。
 */
export function Basic() {
  return (
    <App>
      <SaveButtons />
    </App>
  )
}

function KindButtons() {
  const message = useMessage()
  return (
    <Inline wrap>
      <Button onClick={() => message.success('Published')}>Success</Button>
      <Button onClick={() => message.info('3 members have not confirmed yet')}>Info</Button>
      <Button
        onClick={() => message.warning('The attachment is larger than 20 MB and was skipped')}
      >
        Warning
      </Button>
      <Button onClick={() => message.error('Could not publish: you do not have permission')}>
        Error
      </Button>
      <Button
        onClick={() => message.info({ content: 'Stays open until the sync finishes', duration: 0 })}
      >
        No auto close
      </Button>
      <Button onClick={() => message.destroy()}>Close all</Button>
    </Inline>
  )
}

/**
 * Kinds
 * Choose the kind by meaning: the icon on the left and the color follow the kind; screen readers announce
 * error messages immediately. `duration: 0` does not close automatically; close it with `destroy`.
 * @zh 类型
 * 按语义选择类型：左侧图标与颜色随类型变化；失败消息读屏立即播报。`duration: 0` 不自动关闭，用 `destroy` 关闭。
 * @section Variants
 */
export function Kinds() {
  return (
    <App>
      <KindButtons />
    </App>
  )
}

function RemoveMember() {
  const message = useMessage()
  const [members, setMembers] = useState(['Alex Morgan', 'Sam Lee', 'Jordan Kim'])
  return (
    <Inline>
      {members.map((name) => (
        <Button
          key={name}
          onClick={() => {
            // A reversible action runs right away; the message offers "Undo" instead of asking first
            setMembers((list) => list.filter((m) => m !== name))
            message.undoable({
              content: `Removed from the team: ${name}`,
              onUndo: () => setMembers((list) => (list.includes(name) ? list : [...list, name])),
            })
          }}
        >
          Remove {name}
        </Button>
      ))}
      {members.length === 0 && <Text tone="secondary">The team has no members left</Text>}
    </Inline>
  )
}

/**
 * Undo
 * Reversible actions (moving, archiving, removing, deleting to the trash) run right away, and `undoable` offers
 * "Undo": 6 seconds by default, the timer pauses on hover.
 * @zh 撤销
 * 可恢复的操作（移动、归档、移出、删除到回收站）直接执行，用 undoable 提供「撤销」：默认 6 秒，悬停时暂停计时。
 * @section Advanced
 */
export function Undoable() {
  return (
    <App>
      <RemoveMember />
    </App>
  )
}

function SaveWithProgress() {
  const message = useMessage()
  return (
    <Button
      onClick={() => {
        message.loading({ content: 'Saving…', key: 'save', duration: 0 })
        setTimeout(() => message.success({ content: 'Saved', key: 'save' }), 1200)
      }}
    >
      Save draft
    </Button>
  )
}

/**
 * From in progress to done
 * The same `key` updates the "in progress" message in place with the result.
 * @zh 进行中到完成
 * 用同一个 key 把「进行中」原地更新为结果。
 * @section Advanced
 */
export function Progress() {
  return (
    <App>
      <SaveWithProgress />
    </App>
  )
}
