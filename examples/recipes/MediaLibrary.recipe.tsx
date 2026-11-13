import { useEffect, useState } from 'react'
import {
  Button,
  Descriptions,
  Drawer,
  EmptyState,
  Form,
  Image,
  ImageGrid,
  type ImageGridItem,
  Inline,
  Input,
  Lightbox,
  Page,
  PageSkeleton,
  Panel,
  Pill,
  Progress,
  Segmented,
  Select,
  SelectionBar,
  Stack,
  Text,
  Toolbar,
  Upload,
  type UploadChangeInfo,
  type UploadRequestOptions,
  useConfirmDanger,
  useDelayedPending,
  useMessage,
} from 'vellum-ui'

// —— Data of the recipe: replace with your API ——

type Kind = 'photo' | 'illustration'
type Sort = 'newest' | 'oldest' | 'name' | 'largest'

interface Asset {
  readonly id: string
  readonly name: string
  readonly kind: Kind
  /** The thumbnail and the full image; empty while the file uploads. */
  readonly src: string
  readonly color: string
  /** The MIME type. */
  readonly type: string
  readonly bytes: number
  /** An ISO date and time. */
  readonly added: string
  readonly tags: readonly string[]
  readonly status: 'ready' | 'uploading' | 'failed'
  readonly progress: number
}

const PHOTOS = ['harbor-morning', 'city-lights', 'forest-trail', 'studio-portrait', 'desert-road']
const DRAWINGS = ['onboarding-hero', 'empty-inbox', 'team-badge', 'pricing-header', 'error-page']
const TAGS = ['campaign', 'website', 'social', 'print', 'archive', 'brand']

const pick = <T,>(list: readonly T[], i: number) => list[i % list.length] as T

/** Generated SVG placeholders, so that the recipe runs without real images or a network. */
function artwork(kind: Kind, i: number) {
  const hue = (i * 47) % 360
  const bg = `oklch(0.8 0.06 ${hue})`
  const fg = `oklch(0.48 0.1 ${(hue + 40) % 360})`
  const shapes =
    kind === 'photo'
      ? `<circle cx="${80 + ((i * 61) % 240)}" cy="80" r="30" fill="oklch(0.96 0.05 90)"/><path d="M0 ${190 - (i % 5) * 12} Q140 ${120 + (i % 4) * 12} 240 180 T400 ${160 + (i % 3) * 14} V300 H0Z" fill="${fg}" opacity="0.55"/><path d="M0 250 Q200 ${200 + (i % 6) * 8} 400 236 V300 H0Z" fill="${fg}"/>`
      : `<rect x="${60 + (i % 4) * 30}" y="70" width="120" height="120" rx="24" fill="${fg}" transform="rotate(${(i * 23) % 45} 160 130)"/><circle cx="${250 + (i % 3) * 20}" cy="${170 - (i % 5) * 10}" r="64" fill="oklch(0.97 0.02 ${hue})" opacity="0.85"/><path d="M60 260 L140 180 L220 260Z" fill="${fg}" opacity="0.6"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="${bg}"/>${shapes}</svg>`
  return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, color: bg }
}

const ASSETS: readonly Asset[] = Array.from({ length: 34 }, (_, i) => {
  const kind: Kind = i % 3 === 2 ? 'illustration' : 'photo'
  const base = kind === 'photo' ? pick(PHOTOS, i) : pick(DRAWINGS, i)
  return {
    id: `a${i + 1}`,
    name: `${base}-${String(i + 1).padStart(2, '0')}.${kind === 'photo' ? 'jpg' : 'svg'}`,
    kind,
    ...artwork(kind, i),
    type: kind === 'photo' ? 'image/jpeg' : 'image/svg+xml',
    bytes: kind === 'photo' ? 1_800_000 + ((i * 731_000) % 4_000_000) : 40_000 + i * 9_100,
    added: `2026-10-${String(28 - (i % 28)).padStart(2, '0')}T${String(8 + (i % 10)).padStart(2, '0')}:30:00Z`,
    tags: [pick(TAGS, i), pick(TAGS, i * 5 + 1)].filter((t, n, all) => all.indexOf(t) === n),
    status: 'ready',
    progress: 100,
  }
})

const KIND_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photos' },
  { value: 'illustration', label: 'Illustrations' },
] as const

const SORTS: Record<
  Sort,
  { readonly label: string; readonly compare: (a: Asset, b: Asset) => number }
> = {
  newest: { label: 'Newest first', compare: (a, b) => b.added.localeCompare(a.added) },
  oldest: { label: 'Oldest first', compare: (a, b) => a.added.localeCompare(b.added) },
  name: { label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
  largest: { label: 'Largest first', compare: (a, b) => b.bytes - a.bytes },
}
const SORT_OPTIONS = (Object.keys(SORTS) as Sort[]).map((value) => ({
  value,
  label: SORTS[value].label,
}))

const megabytes = new Intl.NumberFormat('en-US', {
  style: 'unit',
  unit: 'megabyte',
  maximumFractionDigits: 1,
})
const formatSize = (bytes: number) => megabytes.format(bytes / 1_000_000)
const dateTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })
const plural = (n: number, word: string) => (n === 1 ? `1 ${word}` : `${n} ${word}s`)

// —— A simulated server, so that the recipe runs without a network ——

const LATENCY = 600
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Sends one file in steps of 20%; a file whose name contains "error" fails halfway. */
function sendFile({ file, onProgress, onSuccess, onError }: UploadRequestOptions) {
  let percent = 0
  const timer = setInterval(() => {
    percent += 20
    if (percent >= 60 && file.name.toLowerCase().includes('error')) {
      clearInterval(timer)
      onError(new Error('rejected'))
    } else if (percent >= 100) {
      clearInterval(timer)
      // A real server returns the address of the stored file; here it is a local preview
      onSuccess({ url: URL.createObjectURL(file) })
    } else onProgress(percent)
  }, 400)
  return { abort: () => clearInterval(timer) }
}

// —— The details drawer ——

/**
 * The content of the drawer. Drawer unmounts it after closing, so the form starts afresh with the next asset.
 */
function AssetDetails(props: {
  readonly asset: Asset
  readonly onRename: (name: string) => Promise<void>
}) {
  const { asset } = props
  const [form] = Form.useForm<{ name: string }>()
  const [saving, setSaving] = useState(false)
  const save = async ({ name }: { name: string }) => {
    setSaving(true)
    await props.onRename(name.trim())
    setSaving(false)
  }
  return (
    <Stack gap={5}>
      <Image
        src={asset.src}
        alt={asset.name}
        width="100%"
        height={200}
        radius="lg"
        preview={false}
      />
      <Descriptions column={1} size="sm">
        <Descriptions.Item label="Kind">
          <Pill tone="accent">{asset.kind === 'photo' ? 'Photo' : 'Illustration'}</Pill>
        </Descriptions.Item>
        <Descriptions.Item label="Type">
          <Text mono>{asset.type}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="File size">
          <Text numeric>{formatSize(asset.bytes)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Added">
          <Text as="time" dateTime={asset.added} numeric>
            {dateTime.format(new Date(asset.added))}
          </Text>
        </Descriptions.Item>
        <Descriptions.Item label="Tags">
          <Inline gap={1} wrap>
            {asset.tags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </Inline>
        </Descriptions.Item>
      </Descriptions>
      <Form form={form} layout="vertical" initialValues={{ name: asset.name }} onFinish={save}>
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, whitespace: true, message: 'Enter a file name' }]}
        >
          <Input />
        </Form.Item>
        <Inline justify="end">
          <Button variant="primary" loading={saving} onClick={() => form.submit()}>
            Save
          </Button>
        </Inline>
      </Form>
    </Stack>
  )
}

// —— The page ——

/**
 * Media library
 * An asset library that coordinates several overlays: search, a kind filter and a sort in the toolbar, an
 * ImageGrid that opens a Lightbox over the filtered images, and a selection mode whose SelectionBar downloads,
 * deletes after a danger confirmation, or opens a Drawer to rename one asset. Upload shows each file as a tile
 * with its progress; a file whose name contains "error" fails halfway.
 * @zh 素材库
 * 协调多个浮层的素材库：工具栏中的搜索、类型筛选与排序；ImageGrid 打开 Lightbox，在筛选后的图片之间切换；选择模式下
 * SelectionBar 提供下载、经危险确认后删除，或打开 Drawer 查看详情并重命名。上传的文件以带进度的格子出现；文件名含
 * 「error」的文件会在中途失败。
 * @level advanced
 */
export function MediaLibrary() {
  const message = useMessage()
  const confirmDanger = useConfirmDanger()
  const [assets, setAssets] = useState<readonly Asset[]>([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [sort, setSort] = useState<Sort>('newest')
  // In selection mode, clicking a tile selects it instead of opening it
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [viewing, setViewing] = useState<number | null>(null)
  // The drawer keeps showing its asset while it closes, so the id and `open` are separate
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAssets(ASSETS)
      setLoaded(true)
    }, LATENCY)
    return () => clearTimeout(timer)
  }, [])
  // No flash: the skeleton appears only after 200 ms and then stays for at least 400 ms
  const showSkeleton = useDelayedPending(!loaded)
  if (!loaded || showSkeleton) return <PageSkeleton />

  const text = search.trim().toLowerCase()
  const visible = assets
    .filter((a) => kind === 'all' || a.kind === kind)
    .filter(
      (a) => !text || a.name.toLowerCase().includes(text) || a.tags.some((t) => t.includes(text)),
    )
    .sort(SORTS[sort].compare)
  // The lightbox moves between the images of the current filter that have finished uploading
  const viewable = visible.filter((a) => a.status === 'ready')
  const tiles: ImageGridItem[] = visible.map((a) => ({
    id: a.id,
    src: a.src,
    alt: a.name,
    caption: a.status === 'failed' ? `Upload failed: ${a.name}` : a.name,
    placeholderColor: a.status === 'ready' ? a.color : undefined,
    fallback:
      a.status === 'ready' ? undefined : (
        <Progress
          variant="circle"
          size="sm"
          percent={a.progress}
          status={a.status === 'failed' ? 'error' : undefined}
          aria-label={`Upload of ${a.name}`}
        />
      ),
  }))
  const details = assets.find((a) => a.id === detailsId)
  const filtered = text !== '' || kind !== 'all'
  // Files still uploading cannot be selected, so a bulk action never races their upload
  const selectable = visible.filter((a) => a.status !== 'uploading')

  const clearFilters = () => {
    setSearch('')
    setKind('all')
  }
  const clearSelection = () => {
    setSelected(new Set())
    setSelecting(false)
  }
  const open = (index: number) => {
    const asset = visible[index]
    if (!asset) return
    if (selecting) {
      if (asset.status === 'uploading') return
      const next = new Set(selected)
      if (next.has(asset.id)) next.delete(asset.id)
      else next.add(asset.id)
      setSelected(next)
    } else if (asset.status === 'failed')
      message.error(`${asset.name} was not uploaded. Delete it and upload the file again.`)
    else if (asset.status === 'ready') setViewing(viewable.indexOf(asset))
  }

  // Upload reports every change of a file: add its tile, update the progress, then show the image or the failure
  const track = ({ file }: UploadChangeInfo) => {
    if (file.status === 'error') message.error(`Could not upload ${file.name}`)
    if (file.status === 'done') message.success(`Uploaded ${file.name}`)
    setAssets((list) => {
      if (!list.some((a) => a.id === file.uid)) {
        if (file.status !== 'uploading') return list
        const { uid: id, name, type = '', size: bytes = 0 } = file
        const added = new Date().toISOString()
        const empty = { src: '', color: '', tags: ['new'], progress: 0 }
        return [
          { ...empty, id, name, type, bytes, added, kind: 'photo', status: 'uploading' },
          ...list,
        ]
      }
      return list.map((a): Asset => {
        if (a.id !== file.uid) return a
        if (file.status === 'done') {
          // `response` is what `sendFile` passed to `onSuccess`
          const { url } = file.response as { url: string }
          return { ...a, status: 'ready', progress: 100, src: url }
        }
        if (file.status === 'error') return { ...a, status: 'failed' }
        return { ...a, progress: file.percent ?? a.progress }
      })
    })
  }
  const uploadButton = (
    <Upload
      accept="image/*"
      multiple
      showUploadList={false}
      customRequest={sendFile}
      onChange={track}
      onReject={(file) => message.error(`${file.name} is not an image`)}
    >
      <Button variant="primary" icon="upload">
        Upload
      </Button>
    </Upload>
  )

  const download = async () => {
    const content = `Preparing ${plural(selected.size, 'file')}…`
    message.loading({ content, key: 'download', duration: 0 })
    await wait(LATENCY)
    message.success({ content: `Downloaded ${plural(selected.size, 'file')}`, key: 'download' })
  }

  // Irreversible: confirm first
  const remove = async () => {
    const count = selected.size
    const ok = await confirmDanger({
      title: `Delete ${plural(count, 'file')}`,
      description: 'They are removed from every page that uses them. This cannot be undone.',
      okText: 'Delete',
    })
    if (!ok) return
    for (const a of assets)
      if (selected.has(a.id) && a.src.startsWith('blob:')) URL.revokeObjectURL(a.src)
    setAssets((list) => list.filter((a) => !selected.has(a.id)))
    clearSelection()
    message.success(`Deleted ${plural(count, 'file')}`)
  }

  const showDetails = () => {
    setDetailsId([...selected][0] ?? null)
    setDetailsOpen(true)
  }
  const rename = async (name: string) => {
    await wait(LATENCY)
    setAssets((list) => list.map((a) => (a.id === detailsId ? { ...a, name } : a)))
    setDetailsOpen(false)
    message.success('Renamed')
  }

  return (
    <Page
      title="Media library"
      subtitle="Photos and illustrations shared by the team"
      actions={uploadButton}
      fill
      toolbar={
        <SelectionBar
          count={selected.size}
          total={selectable.length}
          onClear={clearSelection}
          onSelectAll={() => setSelected(new Set(selectable.map((a) => a.id)))}
          toolbar={
            <Toolbar
              aria-label="Filters"
              actions={
                <Button
                  icon={selecting ? 'close' : 'check'}
                  onClick={() => setSelecting(!selecting)}
                >
                  {selecting ? 'Cancel' : 'Select'}
                </Button>
              }
            >
              <Input.Search
                aria-label="Search media"
                placeholder="Search by name or tag"
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Segmented aria-label="Kind" options={KIND_OPTIONS} value={kind} onChange={setKind} />
              <Select aria-label="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />
            </Toolbar>
          }
        >
          <Button
            icon="info"
            onClick={showDetails}
            disabled={selected.size !== 1}
            disabledReason="Select one file to see its details"
          >
            Details
          </Button>
          <Button icon="download" onClick={download}>
            Download
          </Button>
          <Button tone="danger" icon="trash" onClick={remove}>
            Delete
          </Button>
        </SelectionBar>
      }
    >
      <Panel fill padding={2}>
        {tiles.length > 0 ? (
          <ImageGrid items={tiles} selectedIds={selected} onOpen={open} />
        ) : filtered ? (
          <EmptyState
            fill
            size="sm"
            icon="search"
            title="No matching files"
            description="Try another name or tag, or clear the search and the filter"
            action={<Button onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            fill
            icon="images"
            title="No files yet"
            description="Upload photos and illustrations to share them with the team"
            action={uploadButton}
          />
        )}
      </Panel>
      <Lightbox
        open={viewing !== null}
        items={viewable}
        index={viewing ?? 0}
        onIndexChange={setViewing}
        onClose={() => setViewing(null)}
      />
      <Drawer title="Details" open={detailsOpen} onClose={() => setDetailsOpen(false)} width={420}>
        {details && <AssetDetails asset={details} onRename={rename} />}
      </Drawer>
    </Page>
  )
}
