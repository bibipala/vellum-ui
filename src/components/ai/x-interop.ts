/**
 * 按组件目录引入 Ant Design X（`@ant-design/x/es/think/index.js` 等，不引入总入口：总入口会带上 mermaid 等很大的依赖）
 * 时的默认导出互操作。组件库内部使用，不从入口导出。
 *
 * 包没有 `"type": "module"`，TypeScript（nodenext）把 `es/` 中的声明看作 CommonJS，默认导入的类型是
 * `{ default: 组件 }`；而 `es/` 实际是 ES 模块，打包器与 Vitest 中默认导入就是组件本身。两种情况都取到组件。
 */
export function esModuleDefault<T>(imported: { readonly default: T }): T {
  const value: unknown = imported
  if (value !== null && typeof value === 'object' && 'default' in value && !('$$typeof' in value))
    return (value as { readonly default: T }).default
  return value as T
}
