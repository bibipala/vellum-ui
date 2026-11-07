import { Pagination } from 'vellum-ui'

/**
 * Basic usage
 * Lists outside a table are paginated on their own; for a DataTable, put the Pagination in its `footer`.
 * @zh 基本用法
 * 不在表格中的列表单独分页；DataTable 的分页放在它的 `footer` 中。
 */
export function Basic() {
  return <Pagination defaultCurrent={2} total={128} pageSize={20} showSizeChanger={false} />
}
