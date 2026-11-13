**English** | [简体中文](../../zh-CN/guides/building-pages.md)

# Building pages

Build consistent application pages with vellum-ui components and semantic props. This guide covers component selection, the application frame, page layouts, interaction states and content formatting, with complete recipes for list, detail and settings pages.

## Principles

1. **Compose existing components.** Use AppShell and Nav for the application frame; Page, SplitView, Panel, Section and Toolbar for page structure; and Stack, Inline, Grid and Box for layout. Add content with components such as ListItem, Pill, Text and DataTable. Standard list, detail, master-detail and settings pages need no custom CSS.
2. **Configure appearance with semantic props.** Components do not accept `style` or `className`; TypeScript enforces this boundary:
   - spacing is a step from 0 to 8: `gap={4}`, `padding={2}` (0, 4, 8, 12, 16, 24, 32, 48, 64 px);
   - color is a `tone`, such as `tone="danger"` or `tone="secondary"`;
   - size is `size="sm"`, `"md"` or `"lg"`; appearance is a `variant`.

   See [Conventions](conventions.md) for supported values. If a component needs an additional capability, request a prop rather than reimplementing it. For visuals specific to your product, follow [Custom styles](custom-styles.md).
3. **Represent every interaction state.** Use the components in [States](#states) for loading, empty, error, submission and confirmation states. An empty table must not conceal a loading error.

Wrap the application in `ThemeProvider` and `App` as described in the [README](../../../README.md), then place pages in an AppShell (see [Application frame](#application-frame)). The examples below assume this setup. `App` provides the context for `useMessage` and `useConfirmDanger`.

## Need → component

| Need | Use | Avoid |
| --- | --- | --- |
| The frame of the application: top bar, sidebar navigation, main area | AppShell, with a Nav in `sidebar` and AppShell.Toggle in `header` | A layout of your own; Segmented or Tabs as the navigation |
| A page with a title, a description and the main action | Page (`title`, `subtitle`, `actions`, `toolbar`) | A hand-written title row |
| Search, filters, view switching above a list | Toolbar (inputs as children, actions in `actions`); in a DataTable, its `toolbar` | Setting widths on inputs: the Toolbar gives them one |
| Choose on the left, see the details on the right | SplitView (`variant="flush"` in full-screen interfaces) | A two-column CSS grid |
| A standalone block of content (table, list, form) | Panel (`flush` for tables and lists) | A Box with a border, or a card of your own |
| Parts of a page or a panel, with a heading | Section | Your own heading and spacing |
| Vertical or horizontal arrangement | Stack, Inline, with Spacer to push items apart | flex, gap or margin in CSS |
| Tiles, card walls, columns | Grid (`columns`, or `minColumn` for responsive filling; `Grid.Item span` for wider cells) | `grid-template-columns` |
| A row of a list (conversation, member, file, result) | ListItem (`leading`, `meta`, `actions`, `selected`, `onClick`) | Your own hover and selected styles |
| Status, marker, tag | Pill (`dot` for a status) | The same status styled differently on two pages |
| Unread or to-do count | CountBadge (`tone="accent"` for things that need attention) | A pill of your own |
| Online, running, failed as a dot | StatusDot with an `aria-label`; on avatars, Avatar `status` | A colored circle in CSS |
| Secondary text, IDs, amounts, times | Text (`tone`, `mono`, `numeric`, `truncate`, `as="time"`) | Classes such as `.muted` or `.mono` |
| A setting with a name and a control | SettingRow inside a Panel | "Text + switch" laid out by hand |
| Icons, buttons with only an icon | Icon, IconButton (`label` is required) | Importing an icon library |
| Actions | Button: `variant="primary"` for the main action (one per area), `tone="danger"` for destructive ones | Several primary buttons side by side |
| Actions in table rows, clickable names, "View" on cards | LinkButton (`tone="danger"` for removing) | A Button that looks like a link |
| More actions in a menu | Dropdown (`menu.items` with icon names), ContextMenu for right click | A Popover with a list of buttons |
| A table | DataTable in `<Panel flush>`: its own columns, sorting, selection, `bulkActions`, pagination in `footer` | Ant Design's Table (not exported) |
| A long list (thousands of rows), a chat, an image wall | VirtualList, MessageList, ImageGrid | Rendering everything at once |
| Read-only fields of a record | Descriptions | A grid of label and value Texts |
| Forms | Form, Form.Item and the inputs of this library | Importing antd; writing antd props (see [Conventions](conventions.md#if-you-know-ant-design)) |
| Short tasks, details next to a list | Modal, Drawer; lay out the content with Stack and Section | A full page for a two-field form |
| Charts and figures | LineChart, AreaChart, BarChart, PieChart, DonutChart, ScatterChart, Heatmap, Statistic, Sparkline, SegmentedBar, Progress | A chart library with its own colors |
| An AI chat | MessageList, Message, MessageActions, PromptInput, PromptSuggestions, Markdown, useStream | A list that re-renders every message on each chunk |
| Keyboard shortcuts | useHotkeys; Kbd to show them | `keydown` listeners on `window` |

Every component has a page with examples and props in the [component overview](../README.md).

## Application frame

Use one AppShell around the application pages: `header` contains the top bar, `sidebar` contains Nav, and the children contain the current page. AppShell fills the viewport and scrolls the page and sidebar independently. AppShell.Toggle collapses the sidebar to icons; on narrow viewports, it opens a drawer. The main area includes a skip link and the `vl-main` view-transition name.

Nav items with `href` render as links and support opening in a new tab. `onSelect` passes the selected key to your routing logic.

```tsx
<AppShell
  header={<><AppShell.Toggle /><Text weight="semibold">Acme</Text><Spacer /><UserMenu /></>}
  sidebar={<Nav items={NAV} value={currentKey} onSelect={navigate} />}
>
  <ProjectsPage />
</AppShell>
```

Control the collapsed state with `collapsed` and `onCollapsedChange`, and persist it in the application to restore it between visits. Use `<AppShell flush>` for full-screen interfaces so that a flush SplitView reaches the viewport edges.

## Page skeletons

The [recipes](#recipes) provide complete, runnable versions of these layouts.

**List page**: Page, then a Panel with the table; search and filters go in the toolbar of the table, so that bulk actions can replace them in place.

```tsx
<Page title="Projects" subtitle="Active and archived projects" actions={<Button variant="primary">New project</Button>}>
  <Panel flush>
    <DataTable
      aria-label="Projects"
      columns={columns}
      rows={rows}
      rowKey={(p) => p.id}
      toolbar={<Input.Search aria-label="Search projects" placeholder="Search by name" allowClear onSearch={setSearch} />}
      footer={<Inline justify="end"><Pagination size="sm" current={page} total={total} onChange={setPage} /></Inline>}
    />
  </Panel>
</Page>
```

**Detail page**: the name of the record is the title, with `back` to its list; fields in a Panel with Descriptions; related records in Sections or Tabs.

```tsx
<Page title={project.name} subtitle={`Owned by ${project.owner}`} back={{ label: 'Back to projects', href: '/projects' }} actions={<Button>Edit</Button>}>
  <Panel title="Details">
    <Descriptions column={2} items={[{ key: 'key', label: 'Reference', children: <Text mono>{project.key}</Text> }]} />
  </Panel>
  <Section title="Activity">…</Section>
</Page>
```

**Master-detail page**: `fill` makes the split view take the remaining height, so that each side scrolls on its own.

```tsx
<Page title="Teams" fill>
  <SplitView
    aside={
      <Stack gap={1} padding={2}>
        {teams.map((t) => (
          <ListItem key={t.id} title={t.name} meta={<CountBadge count={t.size} />} selected={t.id === selectedId} onClick={() => select(t.id)} />
        ))}
      </Stack>
    }
  >
    {selected ? <TeamMembers team={selected} /> : <EmptyState icon="users" title="Select a team" fill />}
  </SplitView>
</Page>
```

**Full-screen interfaces** (chat, image viewing) have no Page: the root is `<SplitView variant="flush">` inside `<AppShell flush>`, which gives it its height.

**Settings page**: a narrow page; one Panel of SettingRows per group, inside a Section.

```tsx
<Page title="Settings" width="narrow">
  <Section title="Notifications">
    <Panel>
      <SettingRow title="Weekly digest" description="A summary every Monday" control={<Switch checked={digest} onChange={toggleDigest} />} />
    </Panel>
  </Section>
</Page>
```

SettingRow provides its title and description as the accessible name and description for library form controls in `control`. Controls with an explicit accessible name, or inside a Form.Item with both `name` and `label`, retain that name. Otherwise, an additional `aria-label` is unnecessary.

**Dashboard**: a Grid of Statistic tiles (one Panel per tile), then a Grid of charts. Charts are cards themselves; do not put them in a Panel (use `plain` when a chart must sit inside one).

## States

| State | Component | Notes |
| --- | --- | --- |
| First load of a page | PageSkeleton (`variant`: `list`, `detail`, `split`) | Its shape matches the final page. |
| Short local loading (a drawer, a dialog, a panel, one side of a split view) | Loading (`fill` to center it in an area) | Use PageSkeleton for a whole page. |
| Part of a page loading | Skeleton | Its shape matches the content that replaces it. |
| Refreshing (page, search, filter, sort) | Keep the old data; DataTable `loading`, chart `loading`, Statistic and SegmentedBar `loading` | The rows or the graphic stay; the indicator appears after 200 ms. |
| No data | EmptyState (`size="sm"` inside panels and lists; DataTable `empty`) | Say why it is empty and offer the next step in `action`. A search without results says so and offers to clear the filters. |
| Loading failed | ErrorState with `onRetry`; DataTable and charts take `error` and `onRetry` | `message` is a text for users, never the raw exception. |
| Submitting | Button `loading`, Modal `okLoading` | Prevents double submission; the width does not change. |
| Result of an action | `useMessage()`: `success`, `error`, `info`, `warning`, `loading` | Short; at most 3 at a time; the same `key` updates a message in place. |
| Reversible action (archive, remove, move to the trash) | `useMessage().undoable({ content, onUndo })` | Run it right away and offer "Undo" (6 seconds); do not ask for confirmation. |
| Cannot act (permission, missing selection) | `disabled` with `disabledReason` on Button, IconButton, LinkButton, PromptInput | The reason shows on hover and keyboard focus, and screen readers read it. |
| Irreversible action (delete, clear data) | `useConfirmDanger()`, with `confirmText` for the name of the object | Focus starts on "Cancel"; with `confirmText`, "Confirm" stays disabled until the name is typed. |
| Small confirmation next to its trigger | Popconfirm (`okTone="danger"`) | For actions with little impact, such as removing one grant. |
| A switch whose change fails | Switch `checked` updated at once, rolled back on failure with `message.error` | Settings that take effect immediately use Switch; settings saved by a button use the form controls. |
| A reply that streams in | Message `status`: `streaming`, `error` with `onRetry`, `stopped` | An empty streaming reply shows "Generating" after 200 ms. |

### No flash

- PageSkeleton, Loading, Skeleton, DataTable `loading`, chart loading states, Statistic, SegmentedBar and Message `status="streaming"` delay their indicators by 200 ms before fading in. Requests that finish sooner display no indicator. Do not add another delay.
- `useDelayedPending(pending)` becomes true after `pending` has lasted 200 ms and remains true for at least 400 ms to prevent flicker. On initial load, also include `isPending` in the condition: this mounts the skeleton immediately and combines its delayed fade-in with the hook.

  ```tsx
  const showSkeleton = useDelayedPending(query.isPending)
  if (query.isPending || showSkeleton) return <PageSkeleton />
  ```

- While refreshing, keep the old data and put an indicator on top only while the hook is true; pass `immediate` so that the delay is not applied twice.

  ```tsx
  const showLoading = useDelayedPending(query.isFetching)
  {showLoading && <Loading immediate />}
  ```

## Text, numbers and times

- **IDs, codes, paths and API names**: `<Text mono>`.
- **Amounts, quantities, counts**: tabular numbers, so that columns line up: `<Text numeric>`, Input `numeric`. DataTable cells and InputNumber already use them; align number columns with `align: 'end'`.
- **Times**: `<Text as="time" dateTime="2026-11-07T14:30:00Z" numeric>Nov 7, 2:30 PM</Text>`. Format with `Intl.DateTimeFormat`; format dates without a time in UTC, so that they do not move by a day.
- **Money and exact decimals**: keep them as decimal strings (`"1280.50"`) from the API to the screen and back. Edit them with `<InputNumber decimal>`, whose value, `min`, `max` and `step` are strings. Format them with `Intl.NumberFormat`, which accepts decimal strings: `money.format(amount as Intl.StringNumericLiteral)`. Never `parseFloat` an amount. Charts and Statistic take numbers: they show rounded figures for reading, not amounts to calculate with.
- **Library text** (empty states, "Retry", "Undo", picker labels) follows ThemeProvider `locale`. Supply application text through your own translations.
- **Errors**: convert exceptions into user-facing messages before passing them to ErrorState, `error` props or `message.error`.

## Don'ts

- Importing `antd`, `@ant-design/*`, `dayjs` or `lucide-react` to build the interface: everything you need is exported by `vellum-ui` (icons by name with Icon).
- Passing `style` or `className` to components, or wrapping them in elements whose only purpose is styling.
- Rebuilding a component the library has (list rows, badges, empty states, tables, dialogs).
- Writing colors, font sizes, spacing, radii, shadows or durations as literals.
- Styling the same meaning in two ways (one status as a Pill here and as colored text there).
- Several primary buttons in one area.
- A confirmation dialog for a reversible action.
- Showing raw exception messages.
- Writing antd props (`type="primary"`, `danger`, `htmlType`, `mode="multiple"`, dayjs values, …): see [If you know Ant Design](conventions.md#if-you-know-ant-design).

## Before committing

- [ ] The application has one AppShell with a Nav; there is no hand-written frame or navigation.
- [ ] The root of the page is Page (or a flush SplitView for a full-screen interface); there is no hand-written title row, toolbar or split.
- [ ] No new CSS; if there is, it is business-specific and follows [Custom styles](custom-styles.md).
- [ ] Every area that loads has a loading, an empty and an error state, and none of them flashes.
- [ ] Buttons that submit show `loading`; disabled actions explain why (`disabledReason`).
- [ ] Reversible actions offer "Undo"; irreversible ones use `useConfirmDanger`.
- [ ] Icon buttons have a `label`; controls without a visible label have an `aria-label`; tables have an `aria-label`.
- [ ] IDs are `mono`, amounts are decimal strings and `numeric`, times use `as="time"`.
- [ ] No antd habits remain ([Conventions](conventions.md)); the type checker passes.
- [ ] Checked in light and dark mode, and in compact density.

## Recipes

Each recipe in `vellum-ui/examples/recipes/` is a complete page that imports only from `vellum-ui` and `react` (the scenarios also from their own CSS Module). Local data simulation includes error states, so the examples run without a backend. Start with the basic recipes; the advanced ones combine their patterns, and the scenarios show whole products with a look of their own.

**Basic**: one page, one way of building it.

| Recipe | What it shows |
| --- | --- |
| [SignIn](../recipes/SignIn.md) | Center with `width="form"`, a Form in a Panel, a submit button with `loading`, an Alert for a failed attempt |
| [GettingStarted](../recipes/GettingStarted.md) | A narrow Page with a Progress of the setup steps, ListItem rows with their own actions, a Grid of Panels |
| [Notifications](../recipes/Notifications.md) | A Segmented filter with a CountBadge, ListItem rows grouped by day, actions on hover, an EmptyState |
| [DetailPage](../recipes/DetailPage.md) | Title and actions with a "More" menu, Descriptions, a meter, Tabs that load on their own; undo and danger confirmation |
| [MasterDetail](../recipes/MasterDetail.md) | SplitView with a searchable list of ListItem; nothing selected, loading, empty and error states on the right |
| [SettingsPage](../recipes/SettingsPage.md) | SettingRow with Switch (optimistic, with rollback), InputNumber and Select saved with a button; a danger zone |
| [FormDialog](../recipes/FormDialog.md) | Modal with a Form: rules, an asynchronous check, a date; `okLoading` and a success message |
| [Dashboard](../recipes/Dashboard.md) | Statistic tiles in a Grid, LineChart, BarChart, DonutChart and SegmentedBar, each with its own states |

**Advanced**: several patterns working together.

| Recipe | What it shows |
| --- | --- |
| [AppFrame](../recipes/AppFrame.md) | AppShell with Nav, Breadcrumb, an account Dropdown with color mode and density, a CommandPalette on Mod+K |
| [MediaLibrary](../recipes/MediaLibrary.md) | ImageGrid with selection and a SelectionBar, Lightbox, a details Drawer, a simulated upload; loading and empty states |
| [ListPage](../recipes/ListPage.md) | Page, DataTable with search, filter, server-side sorting, pagination, selection and bulk actions; loading, empty and error states |
| [ChatPage](../recipes/ChatPage.md) | MessageList, Message, MessageActions, PromptInput and PromptSuggestions with a streamed Markdown reply |

**Scenarios**: whole products from different fields, each with a look of its own (components plus a CSS Module on the design tokens).

| Recipe | What it shows |
| --- | --- |
| [WorkspaceHome](../recipes/WorkspaceHome.md) | A start page: an accent-tinted greeting band, quick-action tiles and project cards with `data-vl-state` |
| [KanbanBoard](../recipes/KanbanBoard.md) | A sprint board: scrolling columns with WIP limits, dense label cards, keyboard moves, a card Drawer |
| [ProductPage](../recipes/ProductPage.md) | A storefront: a large gallery with Lightbox, display type, color and size choices, a cart Drawer, reviews |
| [OpsConsole](../recipes/OpsConsole.md) | A monitoring wall: mono figures, service tiles with Sparklines, live LineChart and AreaChart, a Heatmap, incidents |
| [CalendarWeek](../recipes/CalendarWeek.md) | A week calendar: a time grid with colored events side by side, a mini month, a Modal to create an event |
| [DocsArticle](../recipes/DocsArticle.md) | An editorial documentation page: navigation, a reading measure, Markdown and CodeBlock, an "On this page" outline |
| [MobileWallet](../recipes/MobileWallet.md) | A phone app: a gradient balance card, round actions, a spending bar, transactions, a send sheet with a keypad |
