import { useState } from 'react'
import {
  Button,
  Icon,
  Stack,
  Text,
  Upload,
  type UploadRejectReason,
  type UploadRequestOptions,
} from 'vellum-ui'

const MB = 1024 * 1024

/** Simulates an upload: reports progress every 200 ms, then succeeds (or fails when `fail` returns true). */
function simulate(fail: (file: File) => boolean = () => false) {
  return ({ file, onProgress, onSuccess, onError }: UploadRequestOptions) => {
    let percent = 0
    const timer = setInterval(() => {
      percent += 25
      onProgress(percent)
      if (percent < 100) return
      clearInterval(timer)
      if (fail(file as File)) onError?.(new Error('Server unavailable'))
      else onSuccess?.({ ok: true })
    }, 200)
    return { abort: () => clearInterval(timer) }
  }
}

/**
 * Basic usage
 * Upload does not send requests by itself: here `customRequest` uploads the file and reports progress. Set `accept`
 * and `maxSize` (there are no defaults, so every type and size would be accepted) and tell the user about rejected
 * files in `onReject`.
 * @zh 基本用法
 * 组件自己不发请求：这里由 `customRequest` 上传并汇报进度。请设置 `accept` 与 `maxSize`（没有默认值，否则任何类型与
 * 大小都会被接受），被拒绝的文件在 `onReject` 中告诉用户。
 */
export function Basic() {
  const [rejected, setRejected] = useState<string | null>(null)
  const reasons: Record<UploadRejectReason, string> = {
    type: 'only PDF and Word documents are accepted',
    size: 'files must be 10 MB or smaller',
  }
  return (
    <Stack gap={2}>
      <Upload
        accept=".pdf,.docx"
        maxSize={10 * MB}
        multiple
        customRequest={simulate()}
        onReject={(file, reason) => setRejected(`${file.name}: ${reasons[reason]}`)}
      >
        <Button icon="upload">Choose files</Button>
      </Upload>
      {rejected && (
        <Text tone="danger" size="sm">
          {rejected}
        </Text>
      )}
    </Stack>
  )
}

/**
 * Drop area
 * `Upload.Dropzone` accepts files dragged onto it, and opens the file dialog on click or `Enter` / `Space`. Put the
 * accepted types and the size limit in `hint`.
 * @zh 拖放区
 * `Upload.Dropzone` 接受拖到上面的文件，点击或 `Enter` / 空格打开选择文件的对话框。接受的类型与大小限制写在 `hint` 中。
 * @section Variants
 */
export function Dropzone() {
  return (
    <Upload.Dropzone
      accept="image/png,image/jpeg"
      maxSize={20 * MB}
      multiple
      hint="PNG or JPG, up to 20 MB each"
      customRequest={simulate()}
    />
  )
}

/**
 * Failed uploads and retry
 * A failed file shows "Upload failed" and a "Retry" button that sends the same request again; here the first
 * attempt of every file fails. Files that failed before the page was loaded (without a request to repeat) can only
 * be removed.
 * @zh 上传失败与重试
 * 上传失败的文件显示「上传失败」与「重试」按钮，重试用同样的参数重新请求；这里每个文件的第一次上传都会失败。
 * 页面加载之前就失败的文件（没有可以重复的请求）只能移除。
 * @section States
 */
export function Retry() {
  const [attempts] = useState(() => new Map<string, number>())
  return (
    <Upload
      accept=".csv"
      maxSize={5 * MB}
      customRequest={simulate((file) => {
        const n = (attempts.get(file.name) ?? 0) + 1
        attempts.set(file.name, n)
        return n === 1
      })}
      defaultFileList={[
        { uid: 'contacts', name: 'contacts.csv', size: 48_200, status: 'done' },
        { uid: 'orders', name: 'orders-march.csv', size: 1_250_000, status: 'error' },
      ]}
    >
      <Button icon="upload">Import CSV</Button>
    </Upload>
  )
}

/**
 * Files for a form
 * Without `action` and `customRequest`, nothing is sent: chosen files are only added to the list, and the form
 * sends them on submit. `disabled` hides "Remove" and does not open the dialog.
 * @zh 随表单提交的文件
 * 没有 `action` 与 `customRequest` 时不发送任何请求：选择的文件只加入列表，由表单在提交时发送。`disabled` 时不显示
 * 「移除」，也不打开对话框。
 * @section Advanced
 */
export function WithoutRequest() {
  return (
    <Stack gap={4}>
      <Upload accept=".pdf" maxSize={10 * MB} maxCount={3} multiple>
        <Button>Attach PDFs</Button>
      </Upload>
      <Upload.Dropzone
        disabled
        hint="Uploads are paused"
        defaultFileList={[{ uid: 'brief', name: 'project-brief.pdf', size: 820_000 }]}
      />
    </Stack>
  )
}
