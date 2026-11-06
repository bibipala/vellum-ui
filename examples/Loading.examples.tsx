import { useState } from 'react'
import { Button, Loading, Stack, Text, useDelayedPending } from 'vellum-ui'

/**
 * Basic usage
 * Short loads inside a drawer or panel. After mounting it stays invisible and fades in only after 200 ms.
 * @zh 基本用法
 * 抽屉、面板内部的短暂加载。挂载后先保持不可见，200ms 后才淡入。
 */
export function Basic() {
  return <Loading />
}

/**
 * Keeping old data while refreshing
 * The old content stays in place during a refresh, and useDelayedPending controls the loading indicator: it appears
 * only after 200 ms and then stays for at least 400 ms. The indicator is mounted only while the hook returns true,
 * so pass `immediate` to avoid a second delay.
 * @zh 刷新时保留旧数据
 * 刷新期间旧内容保持不动，加载指示由 useDelayedPending 控制：超过 200ms 才出现、出现后至少 400ms。
 * 指示只在 hook 为 true 时挂载，所以传 immediate，不再延迟一次。
 * @section Advanced
 */
export function Refreshing() {
  const [fetching, setFetching] = useState(false)
  const showLoading = useDelayedPending(fetching)
  return (
    <Stack gap={3}>
      <Button
        onClick={() => {
          setFetching(true)
          setTimeout(() => setFetching(false), 900)
        }}
      >
        Refresh
      </Button>
      <Text>12 new files this week</Text>
      {showLoading && <Loading immediate />}
    </Stack>
  )
}
