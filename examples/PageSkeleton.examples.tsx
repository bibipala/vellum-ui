import { useState } from 'react'
import { Button, Inline, PageSkeleton, Stack, Text, useDelayedPending } from 'vellum-ui'

/**
 * Basic usage
 * First load of a list page. It stays invisible after mounting and fades in after 200 ms, so fast loads do not
 * flash a skeleton.
 * @zh 基本用法
 * 列表类页面首次加载。挂载后先保持不可见，200ms 后才淡入，很快完成的加载不会闪出骨架。
 */
export function Basic() {
  return <PageSkeleton />
}

/**
 * Split view page
 * @zh 主从分栏页面
 * @section Variants
 */
export function Split() {
  return <PageSkeleton variant="split" />
}

/**
 * No flash: shown for at least 400 ms
 * useDelayedPending keeps the skeleton visible for at least 400 ms once it appears, so slightly slow loads do not
 * flash by.
 * On first load, include `isPending` in the condition as well: the skeleton mounts as soon as loading starts, and
 * its own 200 ms delayed fade-in works together with the hook.
 * @zh 防闪：至少显示 400ms
 * 用 useDelayedPending 保证骨架一旦出现至少显示 400ms，稍慢的加载也不会一闪而过。
 * 首次加载把 isPending 也放进条件：骨架在加载开始时就挂载，自带的 200ms 延迟淡入与 hook 同时生效。
 * @section Advanced
 */
export function WithDelayedPending() {
  const [pending, setPending] = useState(false)
  const showSkeleton = useDelayedPending(pending)
  const load = (ms: number) => {
    setPending(true)
    setTimeout(() => setPending(false), ms)
  }
  return (
    <Stack gap={4}>
      <Inline>
        <Button onClick={() => load(150)}>Load in 150 ms</Button>
        <Button onClick={() => load(300)}>Load in 300 ms</Button>
        <Button onClick={() => load(1500)}>Load in 1.5 s</Button>
      </Inline>
      {pending || showSkeleton ? <PageSkeleton /> : <Text>Content loaded</Text>}
    </Stack>
  )
}
