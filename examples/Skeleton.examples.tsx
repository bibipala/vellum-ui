import { Skeleton } from 'vellum-ui'

/**
 * Basic usage
 * A placeholder while part of the content loads; the first load of a whole page uses PageSkeleton.
 * @zh 基本用法
 * 局部内容加载时的占位；整页首次加载用 PageSkeleton。
 */
export function Basic() {
  return <Skeleton active paragraph={{ rows: 3 }} />
}

/**
 * Avatar and paragraph
 * For content with an avatar, such as messages and comments.
 * @zh 头像与段落
 * 消息、评论等带头像的内容。
 * @section Variants
 */
export function WithAvatar() {
  return <Skeleton active avatar paragraph={{ rows: 2 }} />
}
