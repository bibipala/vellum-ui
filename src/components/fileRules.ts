/**
 * 选择文件时的校验与显示：接受的类型（accept）、大小上限（maxSize）、文件大小的写法。
 * Upload 与 PromptInput 共用，不从入口导出。只看文件的名称、类型与大小，不读取文件内容。
 */

/** 文件是否符合 accept：扩展名（`.png`）、MIME 类型（`image/png`）、通配（`image/*`），不区分大小写。 */
export function accepts(file: File, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (rules.length === 0) return true
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return rules.some((rule) => {
    if (rule === '*' || rule === '*/*') return true
    if (rule.startsWith('.')) return name.endsWith(rule)
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1))
    return type === rule
  })
}

/** 文件被拒绝的原因：`type` 不符合 accept，`size` 超过 maxSize；符合时为 null。先查类型，再查大小。 */
export function fileRejectReason(
  file: File,
  rules: { readonly accept?: string; readonly maxSize?: number },
): 'type' | 'size' | null {
  if (rules.accept && !accepts(file, rules.accept)) return 'type'
  if (rules.maxSize !== undefined && file.size > rules.maxSize) return 'size'
  return null
}

/** 文件大小的显示：B、KB、MB、GB（1024 进制，一位小数）。单位符号在各语言中相同。 */
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${i === 0 ? value : value.toFixed(1)} ${units[i]}`
}
