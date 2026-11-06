import { Breadcrumb } from 'vellum-ui'

/**
 * Basic usage
 * The path from the top level to the current page; the last item is the current page and is not a link.
 * @zh 基本用法
 * 从顶层到当前页面的路径；最后一项是当前页，不是链接。
 */
export function Basic() {
  return (
    <Breadcrumb
      items={[
        { title: 'Projects', href: '#projects' },
        { title: 'Website redesign', href: '#projects/website' },
        { title: 'Mockups' },
      ]}
    />
  )
}

/**
 * Buttons and menus
 * Items with only `onClick` are rendered as buttons (for navigation inside the application); `menu` opens a
 * dropdown menu with sibling pages.
 * @zh 按钮与菜单
 * 只有 `onClick` 的项渲染为按钮（用于应用内导航）；`menu` 弹出同级页面的下拉菜单。
 * @section Variants
 */
export function Variants() {
  return (
    <Breadcrumb
      items={[
        { title: 'Files', onClick: () => {} },
        {
          title: 'Design',
          menu: {
            items: [
              { key: 'design', label: 'Design' },
              { key: 'marketing', label: 'Marketing' },
              { key: 'finance', label: 'Finance' },
            ],
          },
        },
        { title: 'Brand assets', onClick: () => {} },
        { title: 'Logos' },
      ]}
    />
  )
}
