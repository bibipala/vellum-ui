import { Pagination } from 'vellum-ui'

/**
 * Basic usage
 * Lists outside a table are paginated on their own; tables use the `pagination` of Table.
 * @zh 基本用法
 * 不在表格中的列表单独分页；表格用 Table 的 `pagination`。
 */
export function Basic() {
  return <Pagination defaultCurrent={2} total={128} pageSize={20} showSizeChanger={false} />
}
