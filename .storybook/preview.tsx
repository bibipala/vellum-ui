import type { Decorator, Preview } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { useGlobals } from 'storybook/preview-api'
import '../src/fonts.css'
import '../src/global.css'
import componentsJson from '../docs/components.json' with { type: 'json' }
import {
  App,
  type ColorModePreference,
  type ComponentDocsJson,
  type Density,
  type DocLanguage,
  type LocaleName,
  Stack,
  Text,
  ThemeProvider,
} from '../src/index.ts'

const componentDocs: ComponentDocsJson = componentsJson

/** 文档文字中的行内标记只有 `代码` 与 **加粗**。 */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      m[1] !== undefined ? (
        <Text key={m.index} as="code" mono size="xs">
          {m[1]}
        </Text>
      ) : (
        <Text key={m.index} weight="semibold">
          {m[2]}
        </Text>
      ),
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/**
 * 生成的示例故事（stories/generated，parameters.example 记着组件名与示例名）：在示例上方按工具栏的语言显示
 * 示例的标题与说明。文字来自 components.json，与文档页同源；故事文件里不重复一份。
 */
const withExampleDoc: Decorator = (Story, context) => {
  const ref = context.parameters.example as { component?: string; name?: string } | undefined
  const example = componentDocs
    .find((c) => c.name === ref?.component)
    ?.examples.find((e) => e.name === ref?.name)
  if (!example) return <Story />
  const lang: DocLanguage = context.globals.locale === 'zh-CN' ? 'zh' : 'en'
  return (
    <Stack gap={5} padding={6}>
      <Stack gap={1}>
        <Text weight="semibold">{example.title[lang]}</Text>
        {example.description[lang] && (
          <Text as="p" tone="secondary" size="sm">
            {inline(example.description[lang])}
          </Text>
        )}
      </Stack>
      {/* 与文档站一样把示例放在块容器中：Stack 会拉伸它的子元素，示例的根（一个按钮、一个触发器）不应随之变宽 */}
      <div>
        <Story />
      </div>
    </Stack>
  )
}

const withTheme: Decorator = (Story, context) => {
  // 明暗与密度受工具栏控制；故事中调用 useTheme().setColorMode / setDensity（如 AppFrame 配方的账户菜单）时写回工具栏
  const [, updateGlobals] = useGlobals()
  return (
    <ThemeProvider
      colorMode={context.globals.mode as ColorModePreference}
      density={context.globals.density as Density}
      locale={context.globals.locale as LocaleName}
      onColorModeChange={(mode) => updateGlobals({ mode })}
      onDensityChange={(density) => updateGlobals({ density })}
    >
      {/* 与文档站一样放在 App 中：示例可以直接调用 useMessage、useConfirmDanger；自带 App 的示例与配方嵌套其中 */}
      <App>
        <Story />
      </App>
    </ThemeProvider>
  )
}

const preview: Preview = {
  // 后面的装饰器包在外层：说明在 ThemeProvider 之内，跟随明暗、密度与语言
  decorators: [withExampleDoc, withTheme],
  // 语言默认 en-US（库的默认语言）：示例中的数据是英文，组件内置文本随之用英文，画面一致。切换为 zh-CN 时，
  // 组件内置文本与示例上方的标题、说明一起切换为中文（示例数据本身只有英文一份）
  initialGlobals: { mode: 'light', density: 'comfortable', locale: 'en-US' },
  globalTypes: {
    mode: {
      description: 'Color mode',
      toolbar: {
        title: 'Mode',
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'system', title: 'System' },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: 'Language: built-in texts, Ant Design, dayjs, and the example descriptions',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'en-US', title: 'English' },
          { value: 'zh-CN', title: '简体中文' },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Density',
      toolbar: {
        title: 'Density',
        icon: 'component',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: { layout: 'fullscreen' },
}

export default preview
