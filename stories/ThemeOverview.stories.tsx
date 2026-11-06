import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  Button,
  cssVar,
  DataTable,
  EmptyState,
  Heading,
  Input,
  Pill,
  Select,
  Text,
  useT,
  useTheme,
  viewerStages,
} from '../src/index.ts'
import styles from './stories.module.css'

const swatches = [
  'color-bg-canvas',
  'color-bg-surface',
  'color-bg-sunken',
  'color-border',
  'color-text-primary',
  'color-text-secondary',
  'color-accent',
  'color-accent-fill',
  'color-accent-hover',
  'color-accent-active',
  'color-accent-subtle',
  'color-accent-text',
  'color-fill',
  'color-fill-selected',
  'color-danger',
  'color-success',
]

const rows = [
  { key: '1', name: 'Laptop stand', qty: '12', price: '1,280.00' },
  { key: '2', name: 'Wireless keyboard', qty: '3', price: '460.50' },
  { key: '3', name: 'USB-C cable', qty: '128', price: '38.00' },
]

function Overview() {
  const { theme, mode } = useTheme()
  const t = useT()
  return (
    <div className={styles.page}>
      <div className={styles.section}>
        <span className={styles.label}>THEME</span>
        <Heading level={1}>
          {t(theme.nameKey as 'theme.default')} · {t(`colorMode.${mode}`)}
        </Heading>
        <p className={styles.accentText}>
          Content comes first; the interface stays quiet and precise.
        </p>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Semantic colors</span>
        <div className={styles.row}>
          {swatches.map((name) => (
            <div key={name} className={styles.swatch}>
              <div className={styles.chip} style={{ background: cssVar(name) }} />
              {name}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Actions</span>
        <div className={styles.row}>
          <Button type="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button type="text">Text</Button>
          <Button danger>Danger</Button>
          <Button type="primary" disabled>
            Disabled
          </Button>
          <Pill>4K</Pill>
          <Pill tone="accent" dot>
            In progress
          </Pill>
        </div>
        <div className={styles.row}>
          <div className={styles.field}>
            <Input placeholder="Search files" />
          </div>
          <Select
            defaultValue="design"
            options={[
              { value: 'design', label: 'Design' },
              { value: 'dev', label: 'Engineering' },
            ]}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.card} style={{ flex: 2 }}>
          <DataTable
            aria-label="Order lines"
            rowKey={(r) => r.key}
            rows={rows}
            columns={[
              { key: 'name', title: 'Item' },
              { key: 'qty', title: 'Quantity', align: 'end' },
              {
                key: 'price',
                title: 'Unit price',
                align: 'end',
                render: (r) => <Text numeric>{r.price}</Text>,
              },
            ]}
          />
        </div>
        <div className={styles.card} style={{ flex: 1 }}>
          <EmptyState size="sm" />
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>
          Viewer background (neutral, does not follow the theme by default)
        </span>
        <div className={styles.row}>
          {viewerStages.map((s) => (
            <div key={s} className={styles.stage} style={{ background: cssVar(`viewer-bg-${s}`) }}>
              {t(`lightbox.stage.${s}`)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const meta: Meta<typeof Overview> = {
  title: 'Overview/Theme overview',
  component: Overview,
}
export default meta

export const ThemeOverview: StoryObj<typeof Overview> = { name: 'Theme overview' }
