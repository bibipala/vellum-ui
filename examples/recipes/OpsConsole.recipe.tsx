import { useEffect, useState } from 'react'
import {
  AreaChart,
  Button,
  type ChartSeries,
  DataTable,
  type DataTableColumn,
  Heatmap,
  type HeatmapCell,
  Icon,
  IconButton,
  LineChart,
  LinkButton,
  Pill,
  type PillTone,
  Popconfirm,
  Segmented,
  Select,
  Sparkline,
  Text,
  Timeline,
  type TimelineItem,
  useMessage,
} from 'vellum-ui'
import styles from './OpsConsole.module.css'

// —— Simulated telemetry: replace with your metrics API (a websocket or a poll) ——

type Env = 'prod' | 'staging'
type Region = 'us-east-1' | 'eu-west-1' | 'ap-southeast-1'
type Range = '1m' | '3m' | '5m'
type Health = 'ok' | 'degraded' | 'down'

/** One sample every 2 seconds while live; the range sets how many samples the charts keep. */
const STEP_MS = 2000
const RANGE_SAMPLES: Record<Range, number> = { '1m': 30, '3m': 90, '5m': 150 }

const REGIONS = [
  { value: 'us-east-1', label: 'us-east-1' },
  { value: 'eu-west-1', label: 'eu-west-1' },
  { value: 'ap-southeast-1', label: 'ap-southeast-1' },
] as const
const REGION_SEED: Record<Region, number> = {
  'us-east-1': 0,
  'eu-west-1': 3.1,
  'ap-southeast-1': 5.7,
}

interface Service {
  readonly id: string
  /** Baseline p95 latency (ms), error ratio and requests per second in prod. */
  readonly p95: number
  readonly err: number
  readonly rps: number
}

const SERVICES: readonly Service[] = [
  { id: 'api-gateway', p95: 84, err: 0.0012, rps: 4200 },
  { id: 'checkout', p95: 212, err: 0.0021, rps: 640 },
  { id: 'payments', p95: 168, err: 0.0009, rps: 520 },
  { id: 'auth', p95: 46, err: 0.0006, rps: 1850 },
  { id: 'search', p95: 138, err: 0.0015, rps: 1320 },
  { id: 'catalog', p95: 72, err: 0.0004, rps: 2100 },
  { id: 'ledger', p95: 95, err: 0.0003, rps: 410 },
  { id: 'notify', p95: 120, err: 0.0018, rps: 380 },
  { id: 'kafka-ingest', p95: 31, err: 0.0002, rps: 5600 },
  { id: 'cdn-edge', p95: 22, err: 0.0001, rps: 9800 },
]

/** How an open incident bends the numbers of its service. */
const HEALTH_FACTOR: Record<Health, { readonly lat: number; readonly err: number }> = {
  ok: { lat: 1, err: 1 },
  degraded: { lat: 2.6, err: 5 },
  down: { lat: 7.5, err: 110 },
}

/** Repeatable noise in [-1, 1]: two slow waves and a little jitter, the same for the same sample and seed. */
function wave(i: number, seed: number) {
  const jitter = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return (
    Math.sin(i * 0.31 + seed) * 0.5 +
    Math.sin(i * 0.11 + seed * 2.3) * 0.3 +
    (jitter - Math.floor(jitter) - 0.5) * 0.4
  )
}

interface Reading {
  readonly p95: number
  readonly err: number
  readonly rps: number
}

function readingOf(
  svc: Service,
  index: number,
  i: number,
  health: Health,
  env: Env,
  region: Region,
): Reading {
  const seed = index * 1.7 + REGION_SEED[region] + (env === 'staging' ? 11 : 0)
  const n = wave(i, seed)
  const f = HEALTH_FACTOR[health]
  return {
    p95: svc.p95 * f.lat * (1 + 0.14 * n),
    err: Math.min(0.4, svc.err * f.err * (1 + 0.35 * n)),
    rps: svc.rps * (env === 'staging' ? 0.06 : 1) * (1 + 0.09 * wave(i, seed + 4)),
  }
}

// —— Incidents: an open one sets the health of its service ——

type Sev = 1 | 2 | 3
type IncidentState = 'triggered' | 'acknowledged' | 'resolved'

interface IncidentEvent {
  /** Seconds after the incident started. */
  readonly at: number
  readonly text: string
  readonly tone: NonNullable<TimelineItem['tone']>
}

interface Incident {
  readonly id: string
  readonly env: Env
  readonly sev: Sev
  readonly title: string
  readonly service: string
  /** Seconds it had been running when the console opened. */
  readonly startedAgo: number
  readonly state: IncidentState
  readonly owner: string | null
  /** The console clock (seconds) at which it was resolved. */
  readonly resolvedAt?: number
  readonly events: readonly IncidentEvent[]
}

const INCIDENTS: readonly Incident[] = [
  {
    id: 'INC-4821',
    env: 'prod',
    sev: 1,
    title: 'Card authorizations failing with 503',
    service: 'payments',
    startedAgo: 1391,
    state: 'triggered',
    owner: null,
    events: [
      { at: 0, text: 'Alert: payments 5xx ratio above 5% for 2 min', tone: 'danger' },
      { at: 42, text: 'Paged primary on-call (payments)', tone: 'neutral' },
      { at: 610, text: 'Escalated to secondary: no acknowledgement', tone: 'warning' },
    ],
  },
  {
    id: 'INC-4819',
    env: 'prod',
    sev: 2,
    title: 'Search p95 above the 400 ms SLO',
    service: 'search',
    startedAgo: 4322,
    state: 'acknowledged',
    owner: 'Priya Nair',
    events: [
      { at: 0, text: 'Alert: search p95 above 400 ms for 5 min', tone: 'warning' },
      { at: 188, text: 'Acknowledged by Priya Nair', tone: 'accent' },
      { at: 1240, text: 'Index rebuild started on shard 7', tone: 'info' },
    ],
  },
  {
    id: 'INC-4814',
    env: 'prod',
    sev: 3,
    title: 'Notification retries piling up',
    service: 'notify',
    startedAgo: 9120,
    state: 'resolved',
    owner: 'Marco Silva',
    resolvedAt: -5400,
    events: [
      { at: 0, text: 'Alert: retry queue above 10k', tone: 'warning' },
      { at: 3720, text: 'Resolved by Marco Silva: provider quota raised', tone: 'success' },
    ],
  },
  {
    id: 'INC-0207',
    env: 'staging',
    sev: 3,
    title: 'Ledger migration slower than expected',
    service: 'ledger',
    startedAgo: 2210,
    state: 'acknowledged',
    owner: 'Dana Wu',
    events: [{ at: 0, text: 'Alert: migration batch over 30 s', tone: 'warning' }],
  },
]

const STATE: Record<IncidentState, { readonly label: string; readonly tone: PillTone }> = {
  triggered: { label: 'Triggered', tone: 'danger' },
  acknowledged: { label: 'Acknowledged', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'success' },
}

// —— Endpoints of the table ——

interface Endpoint {
  readonly method: 'GET' | 'POST' | 'PUT'
  readonly path: string
  readonly service: string
  /** Share of the requests of its service, and its latency next to the p95 of the service. */
  readonly share: number
  readonly lat: number
}

const ENDPOINTS: readonly Endpoint[] = [
  { method: 'POST', path: '/v2/payments/authorize', service: 'payments', share: 0.46, lat: 1.2 },
  { method: 'POST', path: '/v2/payments/capture', service: 'payments', share: 0.31, lat: 0.9 },
  { method: 'GET', path: '/v2/payments/{id}', service: 'payments', share: 0.23, lat: 0.5 },
  { method: 'POST', path: '/v1/checkout/sessions', service: 'checkout', share: 0.4, lat: 1.1 },
  { method: 'PUT', path: '/v1/checkout/cart', service: 'checkout', share: 0.6, lat: 0.8 },
  { method: 'GET', path: '/v3/search', service: 'search', share: 0.82, lat: 1 },
  { method: 'GET', path: '/v3/search/suggest', service: 'search', share: 0.18, lat: 0.6 },
  { method: 'POST', path: '/oauth/token', service: 'auth', share: 0.7, lat: 1.1 },
  { method: 'GET', path: '/v1/products/{sku}', service: 'catalog', share: 0.9, lat: 0.9 },
  { method: 'POST', path: '/v1/ledger/entries', service: 'ledger', share: 1, lat: 1 },
  { method: 'POST', path: '/v1/notify/send', service: 'notify', share: 1, lat: 1 },
]

// —— Formatting: every figure is monospace and has a fixed shape, so a live update never shifts the layout ——

const clockFmt = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})
const hourFmt = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`)
const pct = (v: number) => `${(v * 100).toFixed(v >= 0.1 ? 1 : 2)}%`
const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
const duration = (s: number) => `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`

/** Health from the error ratio and the latency, for the readouts and the table cells. */
const level = (err: number, p95?: number): Health =>
  err >= 0.05 || (p95 ?? 0) >= 1500 ? 'down' : err >= 0.005 || (p95 ?? 0) >= 400 ? 'degraded' : 'ok'

const TEXT_TONE = { ok: undefined, degraded: 'warning', down: 'danger' } as const

// —— The screen ——

/**
 * Operations console
 * The live monitoring screen of an on-call team: a dense, control-room style wall of service tiles, live
 * latency and traffic charts, an error heatmap, incidents with a ticking duration and an endpoint table. Its own
 * CSS Module sets a compact grid of hairline-edged decks over a faint graph-paper canvas, monospace figures in
 * fixed shapes, small uppercase labels and status colors that carry meaning (a degraded tile is tinted, a down
 * one also pulses), all from tokens, so it reads as a dark control room in dark mode and stays clean in light
 * mode. The charts gain a sample every 2 seconds while Live (an interval that is cleared when paused or
 * unmounted); acknowledging or resolving an incident updates its timeline, the health of its service and every
 * figure that depends on it.
 * @zh 运维监控台
 * 值班团队的实时监控屏：密集的"控制室"风格，包括服务磁贴墙、实时延迟与流量图、错误热力图、时长实时走动的事件
 * 列表，以及接口表格。自己的 CSS Module 在淡淡的坐标纸画布上排出紧凑的细线描边面板网格：数字等宽且形状固定，
 * 标签小而大写，状态色承载含义（降级的磁贴带底色，宕机的还会脉动），全部取自令牌，因此暗色模式下像控制室，
 * 亮色模式下依然清爽。实时模式下图表每 2 秒追加一个采样（暂停或卸载时清除定时器）；确认或解决事件会更新它的
 * 时间线、对应服务的健康状态以及所有相关数字。
 * @level scenario
 */
export function OpsConsole() {
  const message = useMessage()
  const [env, setEnv] = useState<Env>('prod')
  const [region, setRegion] = useState<Region>('us-east-1')
  const [range, setRange] = useState<Range>('1m')
  const [live, setLive] = useState(true)
  const [incidents, setIncidents] = useState(INCIDENTS)
  const [selectedId, setSelectedId] = useState('INC-4821')
  const [focus, setFocus] = useState<string | null>(null)
  // The wall clock when the console opened, the seconds since, the latest sample and the time it was taken
  const [opened] = useState(() => Date.now())
  const [clock, setClock] = useState(0)
  const [tick, setTick] = useState(0)
  const [sampledAt, setSampledAt] = useState(opened)

  // Durations tick every second, live or not
  useEffect(() => {
    const id = setInterval(() => setClock((c) => c + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // A new sample every 2 seconds while live; pausing (or leaving the page) clears the interval
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      setTick((t) => t + 1)
      setSampledAt(Date.now())
    }, STEP_MS)
    return () => clearInterval(id)
  }, [live])

  const envIncidents = incidents.filter((i) => i.env === env)
  const open = envIncidents.filter((i) => i.state !== 'resolved')
  const selected = envIncidents.find((i) => i.id === selectedId) ?? envIncidents[0]

  const healthOf = (service: string): Health => {
    const worst = Math.min(4, ...open.filter((i) => i.service === service).map((i) => i.sev))
    return worst === 1 ? 'down' : worst <= 3 ? 'degraded' : 'ok'
  }
  const health = SERVICES.map((s) => healthOf(s.id))
  const read = (index: number, i: number) => {
    const svc = SERVICES[index] as Service
    return readingOf(svc, index, i, health[index] ?? 'ok', env, region)
  }

  // The chart windows: one row per sample, the newest last
  const samples = RANGE_SAMPLES[range]
  const timeOf = (i: number) => clockFmt.format(sampledAt - (tick - i) * STEP_MS)
  const series = Array.from({ length: samples }, (_, k) => {
    const i = tick - samples + 1 + k
    const rows = SERVICES.map((_, index) => read(index, i))
    const total = rows.reduce((sum, r) => sum + r.rps, 0)
    const p95 = rows.reduce((sum, r) => sum + r.p95 * r.rps, 0) / total
    const errors = rows.reduce((sum, r) => sum + r.err * r.rps, 0)
    const client = total * 0.028 * (1 + 0.2 * wave(i, 9))
    return {
      time: timeOf(i),
      p50: Math.round(p95 * 0.44),
      p95: Math.round(p95),
      p99: Math.round(p95 * (1.9 + 0.25 * wave(i, 21))),
      ok: Math.round(total - client - errors),
      client: Math.round(client),
      server: Math.round(errors),
      total,
      errRatio: errors / total,
    }
  })
  const now = series[series.length - 1] as (typeof series)[number]

  const latencySeries: readonly ChartSeries<'p50' | 'p95' | 'p99'>[] = [
    { key: 'p50', name: 'p50' },
    { key: 'p95', name: 'p95' },
    { key: 'p99', name: 'p99' },
  ]
  const trafficSeries: readonly ChartSeries<'ok' | 'client' | 'server'>[] = [
    { key: 'ok', name: '2xx', slot: 1 },
    { key: 'client', name: '4xx', slot: 4 },
    { key: 'server', name: '5xx', slot: 6 },
  ]

  // Errors per hour and service over the last 12 hours; a service with an open incident burns in the latest hours
  const heatmap = (() => {
    const top = new Date(opened)
    top.setMinutes(0, 0, 0)
    const hours = Array.from({ length: 12 }, (_, k) =>
      hourFmt.format(top.getTime() - (11 - k) * 3600_000),
    )
    const cells: HeatmapCell[] = []
    SERVICES.forEach((svc, index) => {
      const burning = health[index] ?? 'ok'
      hours.forEach((hour, k) => {
        const base =
          svc.rps * svc.err * 36 * (1 + 0.6 * wave(k * 5, index * 2.2 + REGION_SEED[region]))
        const spike =
          burning === 'ok' || k < 10 ? 1 : HEALTH_FACTOR[burning].err * (k === 11 ? 1 : 0.4)
        cells.push({
          x: hour,
          y: svc.id,
          value: Math.round(base * spike * (env === 'staging' ? 0.06 : 1)),
        })
      })
    })
    return { hours, cells }
  })()

  // The endpoint table: live numbers of each endpoint, filtered to the focused service
  const endpointRows = ENDPOINTS.filter((e) => !focus || e.service === focus).map((e) => {
    const index = SERVICES.findIndex((s) => s.id === e.service)
    const r = read(index, tick)
    return {
      ...e,
      key: `${e.method} ${e.path}`,
      rps: r.rps * e.share,
      p50: r.p95 * e.lat * 0.42,
      p95: r.p95 * e.lat,
      p99: r.p95 * e.lat * 2.1,
      err: r.err * (0.6 + e.lat * 0.4),
      trend: Array.from({ length: 16 }, (_, k) =>
        Math.round(read(index, tick - 15 + k).p95 * e.lat),
      ),
    }
  })
  type Row = (typeof endpointRows)[number]

  const columns: readonly DataTableColumn<Row>[] = [
    {
      key: 'path',
      title: 'Endpoint',
      hideable: false,
      render: (r) => (
        <span className={styles.endpoint}>
          <span className={styles.method} data-method={r.method}>
            {r.method}
          </span>
          <Text mono size="xs" truncate>
            {r.path}
          </Text>
        </span>
      ),
    },
    {
      key: 'service',
      title: 'Service',
      width: 130,
      render: (r) => (
        <Text mono size="xs">
          {r.service}
        </Text>
      ),
    },
    ...(
      [
        ['rps', 'Req/s', (r: Row) => compact.format(r.rps)],
        ['p50', 'p50', (r: Row) => ms(r.p50)],
        ['p95', 'p95', (r: Row) => ms(r.p95)],
        ['p99', 'p99', (r: Row) => ms(r.p99)],
      ] as const
    ).map(
      ([key, title, show]): DataTableColumn<Row> => ({
        key,
        title,
        align: 'end',
        width: 104,
        compare: (a, b) => a[key] - b[key],
        render: (r) => (
          <Text
            mono
            numeric
            size="xs"
            tone={key === 'p95' ? TEXT_TONE[level(0, r.p95)] : undefined}
          >
            {show(r)}
          </Text>
        ),
      }),
    ),
    {
      key: 'err',
      title: 'Errors',
      align: 'end',
      width: 96,
      compare: (a, b) => a.err - b.err,
      render: (r) => (
        <Text mono numeric size="xs" weight="semibold" tone={TEXT_TONE[level(r.err)]}>
          {pct(r.err)}
        </Text>
      ),
    },
    {
      key: 'trend',
      title: 'p95, last 30 s',
      width: 140,
      resizable: false,
      render: (r) => (
        <Sparkline data={r.trend} label={`p95 of ${r.path}, last 30 seconds`} size="sm" />
      ),
    },
  ]

  // —— Incident actions: in a real console these call the paging API ——

  const durationOf = (i: Incident) => i.startedAgo + (i.resolvedAt ?? clock)
  const update = (id: string, change: (i: Incident) => Incident) =>
    setIncidents((list) => list.map((i) => (i.id === id ? change(i) : i)))

  const acknowledge = (inc: Incident) => {
    update(inc.id, (i) => ({
      ...i,
      state: 'acknowledged',
      owner: 'You',
      events: [
        ...i.events,
        { at: durationOf(i), text: 'Acknowledged by you: paging stopped', tone: 'accent' },
      ],
    }))
    message.success(`${inc.id} acknowledged, paging stopped`)
  }

  const resolve = async (inc: Incident) => {
    await new Promise((r) => setTimeout(r, 700))
    update(inc.id, (i) => ({
      ...i,
      state: 'resolved',
      owner: i.owner ?? 'You',
      resolvedAt: clock,
      events: [...i.events, { at: durationOf(i), text: 'Resolved by you', tone: 'success' }],
    }))
    message.success(`${inc.id} resolved, ${inc.service} is back to normal`)
  }

  const availability = 1 - now.errRatio
  const budget = Math.max(0, 0.74 - now.errRatio * 9)
  const readouts = [
    { label: 'Availability', value: pct(availability), state: level(1 - availability) },
    { label: 'p95 latency', value: ms(now.p95), state: level(0, now.p95 * 2.2) },
    { label: 'Error rate', value: pct(now.errRatio), state: level(now.errRatio) },
    { label: 'Throughput', value: `${compact.format(now.total)}/s`, state: 'ok' as Health },
    {
      label: 'Open incidents',
      value: String(open.length),
      state: (open.some((i) => i.sev === 1) ? 'down' : open.length ? 'degraded' : 'ok') as Health,
    },
    { label: 'Error budget', value: pct(budget), state: (budget < 0.25 ? 'down' : 'ok') as Health },
  ]

  return (
    <div className={styles.console} data-env={env}>
      {/* —— Command bar: what you are looking at, and whether it is moving —— */}
      <header className={styles.bar}>
        <div className={styles.callsign}>
          <span className={styles.mark}>
            <Icon name="activity" size={16} />
          </span>
          <div className={styles.titleBlock}>
            <span className={styles.label}>Ops console</span>
            <h1 className={styles.title}>payments-platform</h1>
          </div>
          <span className={styles.envTag} data-env={env}>
            {env}
          </span>
        </div>
        <div className={styles.controls}>
          <Segmented<Env>
            size="sm"
            value={env}
            onChange={setEnv}
            options={[
              { value: 'prod', label: 'prod' },
              { value: 'staging', label: 'staging' },
            ]}
          />
          <Select<Region>
            size="sm"
            aria-label="Region"
            value={region}
            onChange={setRegion}
            options={REGIONS}
          />
          <Segmented<Range>
            size="sm"
            value={range}
            onChange={setRange}
            options={(['1m', '3m', '5m'] as const).map((r) => ({
              value: r,
              label: r,
              title: `Last ${r}`,
            }))}
          />
        </div>
        <div className={styles.liveGroup}>
          <Text size="xs" tone="secondary">
            {live ? 'Updated' : 'Paused at'}{' '}
            <Text mono numeric size="xs" tone="primary" as="time">
              {clockFmt.format(sampledAt)}
            </Text>
          </Text>
          <button
            type="button"
            className={styles.live}
            data-live={live}
            aria-pressed={live}
            data-vl-state=""
            onClick={() => setLive((l) => !l)}
          >
            <span className={styles.pulse} aria-hidden="true" />
            {live ? 'Live' : 'Paused'}
          </button>
          <IconButton
            icon="refresh"
            label="Refresh now"
            size="sm"
            onClick={() => {
              setTick((t) => t + 1)
              setSampledAt(Date.now())
            }}
          />
          <Button
            size="sm"
            tone="danger"
            icon="alert"
            onClick={() => message.info('Open the declare-incident form here')}
          >
            Declare incident
          </Button>
        </div>
      </header>

      {/* —— Readouts: the six numbers the on-call engineer checks first —— */}
      <section className={styles.readouts} aria-label="Key figures">
        {readouts.map((r) => (
          <div key={r.label} className={styles.readout} data-state={r.state}>
            <span className={styles.label}>{r.label}</span>
            <span className={styles.figure}>{r.value}</span>
          </div>
        ))}
      </section>

      <div className={styles.layout}>
        <div className={styles.main}>
          {/* —— Service wall: one tile per service; a tile filters the endpoint table —— */}
          <section className={styles.deck} aria-labelledby="ops-wall">
            <div className={styles.deckHead}>
              <h2 id="ops-wall" className={styles.label}>
                Services
              </h2>
              <span className={styles.legend}>
                {(['ok', 'degraded', 'down'] as const).map((h) => (
                  <span key={h} className={styles.legendItem} data-health={h}>
                    {health.filter((x) => x === h).length} {h}
                  </span>
                ))}
              </span>
            </div>
            <div className={styles.wall}>
              {SERVICES.map((svc, index) => {
                const h = health[index] ?? 'ok'
                const r = read(index, tick)
                const trend = Array.from({ length: 20 }, (_, k) =>
                  Math.round(read(index, tick - 19 + k).p95),
                )
                return (
                  <button
                    key={svc.id}
                    type="button"
                    className={styles.tile}
                    data-health={h}
                    data-vl-state=""
                    aria-pressed={focus === svc.id}
                    onClick={() => setFocus((f) => (f === svc.id ? null : svc.id))}
                  >
                    <span className={styles.tileHead}>
                      <span className={styles.lamp} aria-hidden="true" />
                      <span className={styles.tileName}>{svc.id}</span>
                      <span className={styles.tileState}>{h}</span>
                    </span>
                    <span className={styles.tileFigures}>
                      <span>
                        <span className={styles.unit}>p95</span> {ms(r.p95)}
                      </span>
                      <span>
                        <span className={styles.unit}>err</span> {pct(r.err)}
                      </span>
                    </span>
                    <Sparkline data={trend} label={`${svc.id} p95, last 40 seconds`} size="sm" />
                  </button>
                )
              })}
            </div>
          </section>

          <div className={styles.pair}>
            <section className={styles.deck} aria-labelledby="ops-latency">
              <div className={styles.deckHead}>
                <h2 id="ops-latency" className={styles.label}>
                  Latency
                </h2>
                <span className={styles.headFigure}>p95 {ms(now.p95)}</span>
              </div>
              <LineChart
                plain
                aria-label="Platform latency, p50, p95 and p99"
                data={series}
                x="time"
                series={latencySeries}
                format={ms}
                height={200}
              />
            </section>
            <section className={styles.deck} aria-labelledby="ops-traffic">
              <div className={styles.deckHead}>
                <h2 id="ops-traffic" className={styles.label}>
                  Requests
                </h2>
                <span className={styles.headFigure}>{compact.format(now.total)}/s</span>
              </div>
              <AreaChart
                plain
                stacked
                aria-label="Requests per second by status class"
                data={series}
                x="time"
                series={trafficSeries}
                format="compact"
                height={200}
              />
            </section>
          </div>

          <section className={styles.deck} aria-labelledby="ops-heat">
            <div className={styles.deckHead}>
              <h2 id="ops-heat" className={styles.label}>
                Errors by hour
              </h2>
              <span className={styles.headNote}>last 12 h, {region}</span>
            </div>
            <Heatmap
              plain
              aria-label="Errors per hour and service"
              xCategories={heatmap.hours}
              yCategories={SERVICES.map((s) => s.id)}
              data={heatmap.cells}
              xLabel="Hour"
              yLabel="Service"
              valueLabel="Errors"
              height={300}
            />
          </section>
        </div>

        {/* —— Incidents: the queue, then the selected one with its actions and timeline —— */}
        <aside className={styles.side}>
          <section className={styles.deck} aria-labelledby="ops-incidents">
            <div className={styles.deckHead}>
              <h2 id="ops-incidents" className={styles.label}>
                Incidents
              </h2>
              <span className={styles.headNote}>{open.length} open</span>
            </div>
            <ul className={styles.queue}>
              {envIncidents.map((inc) => (
                <li key={inc.id}>
                  <button
                    type="button"
                    className={styles.incident}
                    data-state={inc.state}
                    data-vl-state=""
                    aria-pressed={inc.id === selected?.id}
                    onClick={() => setSelectedId(inc.id)}
                  >
                    <span className={styles.sev} data-sev={inc.sev}>
                      SEV{inc.sev}
                    </span>
                    <span className={styles.incidentBody}>
                      <span className={styles.incidentTitle}>{inc.title}</span>
                      <span className={styles.incidentMeta}>
                        {inc.id} · {inc.service} · {inc.owner ?? 'unassigned'}
                      </span>
                    </span>
                    <span className={styles.timer} data-running={inc.state !== 'resolved'}>
                      {duration(durationOf(inc))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {selected && (
            <section className={styles.deck} aria-labelledby="ops-detail" data-sev={selected.sev}>
              <div className={styles.deckHead}>
                <h2 id="ops-detail" className={styles.label}>
                  {selected.id}
                </h2>
                <Pill tone={STATE[selected.state].tone} dot>
                  {STATE[selected.state].label}
                </Pill>
              </div>
              <div className={styles.detail}>
                <Text weight="semibold">{selected.title}</Text>
                <dl className={styles.facts}>
                  <dt>Service</dt>
                  <dd>{selected.service}</dd>
                  <dt>Owner</dt>
                  <dd>{selected.owner ?? 'unassigned'}</dd>
                  <dt>Duration</dt>
                  <dd>{duration(durationOf(selected))}</dd>
                </dl>
                {selected.state !== 'resolved' && (
                  <div className={styles.actions}>
                    {selected.state === 'triggered' && (
                      <Button
                        size="sm"
                        variant="primary"
                        icon="check"
                        onClick={() => acknowledge(selected)}
                      >
                        Acknowledge
                      </Button>
                    )}
                    <Popconfirm
                      title={`Resolve ${selected.id}?`}
                      description="Paging stops and the service returns to normal on the wall."
                      okText="Resolve"
                      onConfirm={() => resolve(selected)}
                    >
                      <Button size="sm" icon="check-circle">
                        Resolve
                      </Button>
                    </Popconfirm>
                    <LinkButton
                      icon="external-link"
                      onClick={() => message.info('Open the runbook here')}
                    >
                      Runbook
                    </LinkButton>
                  </div>
                )}
                <Timeline
                  items={selected.events.map((e) => ({
                    key: `${e.at}-${e.text}`,
                    tone: e.tone,
                    content: (
                      <span className={styles.event}>
                        <span className={styles.eventAt}>T+{duration(e.at)}</span>
                        <Text size="sm">{e.text}</Text>
                      </span>
                    ),
                  }))}
                />
              </div>
            </section>
          )}
        </aside>
      </div>

      {/* —— Endpoints: the live table, filtered by the focused tile —— */}
      <section className={styles.deck} aria-labelledby="ops-endpoints">
        <DataTable
          aria-label="Endpoints"
          rows={endpointRows}
          rowKey={(r) => r.key}
          columns={columns}
          defaultSort={{ key: 'err', direction: 'desc' }}
          toolbar={
            <div className={styles.deckHead}>
              <h2 id="ops-endpoints" className={styles.label}>
                Endpoints
              </h2>
              {focus ? (
                <span className={styles.filter}>
                  <Pill tone="accent" icon="filter">
                    {focus}
                  </Pill>
                  <LinkButton onClick={() => setFocus(null)}>Show all</LinkButton>
                </span>
              ) : (
                <span className={styles.headNote}>select a service tile to filter</span>
              )}
            </div>
          }
        />
      </section>
    </div>
  )
}
