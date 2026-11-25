/** 焦点候选元素；禁用、隐藏与 tabindex 的有效性在运行时判断，不能只靠选择器。 */
export const FOCUS_CANDIDATE = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
  '[contenteditable="true"]',
  '[contenteditable=""]',
].join(',')

/** 有布局盒仍可能被 visibility 隐藏；沿用 inert、hidden 与读屏隐藏祖先的排除规则。 */
export function isVisible(el: HTMLElement): boolean {
  const visibility = getComputedStyle(el).visibility
  return (
    visibility !== 'hidden' &&
    visibility !== 'collapse' &&
    !el.closest('[inert], [hidden], [aria-hidden="true"]') &&
    el.getClientRects().length > 0
  )
}

/** 可按 Tab 到达的候选元素；:disabled 同时处理 disabled fieldset（保留首个 legend 的例外）。 */
export function isTabbable(el: HTMLElement): boolean {
  return (
    el.matches(FOCUS_CANDIDATE) &&
    !el.matches(':disabled, input[type="hidden"]') &&
    (el.tabIndex >= 0 ||
      (!el.hasAttribute('tabindex') &&
        el.isContentEditable &&
        !el.parentElement?.isContentEditable)) &&
    isVisible(el)
  )
}
