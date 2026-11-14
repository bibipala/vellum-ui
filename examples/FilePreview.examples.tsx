import { useMemo, useState } from 'react'
import {
  Box,
  FilePreview,
  type FilePreviewItem,
  Icon,
  IconButton,
  ImageGrid,
  ListItem,
  Splitter,
  Stack,
  Text,
} from 'vellum-ui'
import { sampleFiles } from '../stories/sample.ts'
import { DemoFrame } from './_frame.tsx'

/**
 * Basic usage
 * Open any file of a list: images open from their tile and can be zoomed (wheel, double click, `+` / `-`), text and
 * data files are shown on a sheet, and the PDF, which the browser cannot show here, gets a card. Switch with `←` /
 * `→` or by dragging sideways; drag up or down to close.
 * @zh 基本用法
 * 打开列表中的任意文件：图片从格子中长出，可以缩放（滚轮、双击、`+` / `-`），文本与数据文件显示在一张「纸」上，浏览器在
 * 这里显示不了的 PDF 显示为卡片。用 `←` / `→` 或横向拖动切换，上下拖动关闭。
 */
export function Basic() {
  const files = useMemo(() => sampleFiles(), [])
  const [index, setIndex] = useState<number | null>(null)
  const tiles = files.map((file) => ({
    id: file.id,
    src: file.src ?? '',
    alt: file.name,
    caption: file.name,
    fallback: <Icon name={file.name.endsWith('.pdf') ? 'file' : 'file-text'} size={28} />,
  }))
  return (
    <DemoFrame>
      <ImageGrid items={tiles} onOpen={(i) => setIndex(i)} />
      <FilePreview
        open={index !== null}
        items={files}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
      />
    </DemoFrame>
  )
}

/**
 * Inline preview
 * `FilePreview.Inline` shows the selected file next to the list and fills the height of its parent. Zoom images with
 * a double click or `Ctrl` + wheel; "Full screen" opens the full-window preview, and the image flies out of the
 * area and back.
 * @zh 嵌入式预览
 * `FilePreview.Inline` 在列表旁显示选中的文件，高度占满父元素。图片双击或 `Ctrl` + 滚轮缩放；「全屏查看」打开铺满窗口的
 * 预览，图片从区域中飞出、关闭时飞回。
 * @section Variants
 */
export function Inline() {
  const files = useMemo(() => sampleFiles(), [])
  const [selected, setSelected] = useState<FilePreviewItem | null>(files[0] ?? null)
  return (
    <DemoFrame>
      <Splitter defaultSize={220} min={160} max={320} aria-label="Resize the file list">
        <Box surface="canvas" padding={2} grow>
          <Stack gap={1}>
            {files.map((file) => (
              <ListItem
                key={file.id}
                density="compact"
                title={file.name}
                selected={selected?.id === file.id}
                onClick={() => setSelected(file)}
              />
            ))}
          </Stack>
        </Box>
        <Box padding={3} grow>
          <FilePreview.Inline item={selected} />
        </Box>
      </Splitter>
    </DemoFrame>
  )
}

/**
 * Downloads, actions and your own renderer
 * `onDownload` adds a "Download" button (here with a link that has `download`); `actions` adds your own buttons; and
 * `render` shows file types that the preview does not support, here a PDF as a summary card. Return `undefined` from
 * `render` to keep the built-in preview.
 * @zh 下载、自定义按钮与自定义渲染
 * `onDownload` 显示「下载」按钮（这里用带 `download` 的链接下载）；`actions` 加入自己的按钮；`render` 显示预览不支持的
 * 文件类型，这里把 PDF 显示为一张摘要卡片。`render` 返回 `undefined` 时使用内置的预览。
 * @section Advanced
 */
export function Custom() {
  const files = useMemo(() => sampleFiles(), [])
  const [index, setIndex] = useState<number | null>(null)
  const download = (file: FilePreviewItem) => {
    const link = document.createElement('a')
    link.href =
      file.src ?? `data:text/plain;charset=utf-8,${encodeURIComponent(file.content ?? '')}`
    link.download = file.name
    link.click()
  }
  return (
    <>
      <Stack gap={1}>
        {files.map((file, i) => (
          <ListItem key={file.id} density="compact" title={file.name} onClick={() => setIndex(i)} />
        ))}
      </Stack>
      <FilePreview
        open={index !== null}
        items={files}
        index={index ?? 0}
        onIndexChange={setIndex}
        onClose={() => setIndex(null)}
        onDownload={download}
        actions={(file) => (
          <IconButton
            icon="share"
            label="Copy link"
            onClick={() => navigator.clipboard?.writeText(file.name)}
          />
        )}
        render={(file) =>
          file.type === 'application/pdf' ? (
            <Box surface="surface" padding={6} radius="xl">
              <Stack gap={2}>
                <Text weight="semibold">{file.name}</Text>
                <Text tone="secondary">
                  Quarterly report, 12 pages. Open it in your PDF reader to see the charts.
                </Text>
              </Stack>
            </Box>
          ) : undefined
        }
      />
    </>
  )
}
