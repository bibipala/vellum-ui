[English](../../en-US/guides/building-pages.md) | **简体中文**

# 搭建页面

如何用 vellum-ui 搭建页面：用组件拼出页面，只设置语义参数，不写样式；在一张表中为每种需求找到对应的组件；从一种页面骨架开始；每种状态（加载、空、错误、提交中、危险操作）都用专门的组件表达，而且不闪；文字、数字与时间的写法全站一致；提交前对照文末的清单检查。

## 原则

1. **用组件拼，不写样式。** 页面的框架用模式组件（Page、SplitView、Panel、Section、Toolbar），内容用基础组件（ListItem、Pill、Text、DataTable 等），排列用原语（Stack、Inline、Grid、Box）。标准的列表页、详情页、主从页、设置页一行 CSS 都不需要。
2. **只用语义参数。** 组件不接受 `style` 与 `className`（TypeScript 会报错）。外观只能用语义参数调整：
   - 间距取 0 到 8 的档位：`gap={4}`、`padding={2}`（0、4、8、12、16、24、32、48、64px）；
   - 颜色取色调 `tone`，如 `tone="danger"`、`tone="secondary"`；
   - 尺寸取 `size="sm"`、`"md"`、`"lg"`；外观取 `variant`。

   确切的取值见[接口约定](conventions.md)。组件做不到所需的效果时，不要在应用里重新实现：提出需要的参数；或者确认这是业务特有的视觉，按[自定义样式](custom-styles.md)来写。
3. **每种状态都有样子。** 加载、空、错误、提交中、确认各有对应的组件（见[状态](#状态)）。不要用空表格掩盖错误。

应用最外层包一次 `ThemeProvider` 与 `App`（见 README）；下面的每个页面都假定两者已经存在。`App` 为 `useMessage` 与 `useConfirmDanger` 提供上下文。

## 需求 → 组件

| 需求 | 用这个 | 不要这样做 |
| --- | --- | --- |
| 带标题、说明与主操作的页面 | Page（`title`、`subtitle`、`actions`、`toolbar`） | 自己写标题行 |
| 列表上方的搜索、筛选、视图切换 | Toolbar（输入放在子元素中，操作放在 `actions`）；DataTable 用它自己的 `toolbar` | 给输入框设宽度：工具栏会统一宽度 |
| 左侧选择、右侧看详情 | SplitView（全屏界面用 `variant="flush"`） | 用 CSS grid 写两栏 |
| 一块独立的内容（表格、列表、表单） | Panel（表格与列表加 `flush`） | 带描边的 Box，或自己写卡片 |
| 页面或面板中带标题的分段 | Section | 自己写小标题与间距 |
| 纵向、横向排列 | Stack、Inline，用 Spacer 把元素推开 | 在 CSS 里写 flex、gap、margin |
| 格子、卡片墙、多栏 | Grid（`columns`，或用 `minColumn` 按宽度自动填充） | `grid-template-columns` |
| 列表的一行（会话、成员、文件、搜索结果） | ListItem（`leading`、`meta`、`actions`、`selected`、`onClick`） | 自己写悬停与选中样式 |
| 状态、标记、标签 | Pill（状态加 `dot`） | 同一个状态在两个页面用不同的样式 |
| 未读数、待办数 | CountBadge（需要关注的用 `tone="accent"`） | 自己写胶囊 |
| 在线、运行、失败等状态圆点 | StatusDot，并写 `aria-label`；头像上用 Avatar 的 `status` | 用 CSS 画彩色圆点 |
| 次要文字、编号、金额、时间 | Text（`tone`、`mono`、`numeric`、`truncate`、`as="time"`） | `.muted`、`.mono` 之类的类名 |
| 有名称与控件的设置项 | 放在 Panel 中的 SettingRow | 手工排列「文字 + 开关」 |
| 图标、只有图标的按钮 | Icon、IconButton（`label` 必填） | 直接导入图标库 |
| 操作 | Button：主操作用 `variant="primary"`（每个区域一个），危险操作加 `tone="danger"` | 并排放几个主按钮 |
| 表格行内操作、可点击的名称、卡片上的「查看」 | LinkButton（移除类操作用 `tone="danger"`） | 把 Button 做成链接的样子 |
| 菜单中的更多操作 | Dropdown（`menu.items` 中的图标写图标名），右键用 ContextMenu | 用 Popover 放一列按钮 |
| 表格 | 放在 `<Panel flush>` 中的 DataTable：自己的列定义、排序、多选、`bulkActions`，分页放在 `footer` | Ant Design 的 Table（不导出） |
| 长列表（上千行）、聊天、图片墙 | VirtualList、MessageList、ImageGrid | 一次渲染全部 |
| 一条记录的只读字段 | Descriptions | 用 Text 拼「标签：值」的网格 |
| 表单 | Form、Form.Item 与本库的输入组件 | 导入 antd；按 antd 的属性写（见[接口约定](conventions.md#如果你熟悉-ant-design)） |
| 简短的任务、列表旁的详情 | Modal、Drawer；内容用 Stack 与 Section 排版 | 为两个字段的表单单独开一个页面 |
| 图表与数字 | LineChart、AreaChart、BarChart、PieChart、DonutChart、ScatterChart、Heatmap、Statistic、Sparkline、SegmentedBar、Progress | 另用一个自带配色的图表库 |
| AI 对话 | MessageList、Message、MessageActions、PromptInput、PromptSuggestions、Markdown、useStream | 每收到一段文字就重新渲染全部消息的列表 |
| 快捷键 | useHotkeys；用 Kbd 显示 | 在 `window` 上监听 `keydown` |

每个组件都有一页示例与属性表，见[组件总览](../README.md)。

## 页面骨架

这些骨架的完整、可运行版本见[页面配方](#页面配方)。

**列表页**：Page 之下是装着表格的 Panel；搜索与筛选放在表格的工具栏中，批量操作出现时原地替换它们。

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

**详情页**：记录的名称作标题；字段放在 Panel 中用 Descriptions 展示；相关记录放在 Section 或 Tabs 中。

```tsx
<Page title={project.name} subtitle={`Owned by ${project.owner}`} actions={<Button>Edit</Button>}>
  <Panel title="Details">
    <Descriptions column={2} items={[{ key: 'key', label: 'Reference', children: <Text mono>{project.key}</Text> }]} />
  </Panel>
  <Section title="Activity">…</Section>
</Page>
```

**主从页**：`fill` 让主从分栏占满剩余高度，两侧各自滚动。

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

**全屏界面**（聊天、看图）不用 Page：根元素是 `<SplitView variant="flush">`，高度由应用外壳提供。

**设置页**：窄页面；每组设置是 Section 中的一个 Panel，里面是若干 SettingRow。

```tsx
<Page title="Settings" width="narrow">
  <Section title="Notifications">
    <Panel>
      <SettingRow title="Weekly digest" description="A summary every Monday" control={<Switch checked={digest} onChange={toggleDigest} />} />
    </Panel>
  </Section>
</Page>
```

SettingRow 为它的控件命名：`control` 中的组件库表单控件以标题为读屏名称、以说明为读屏说明，不需要再加 `aria-label`。

**仪表盘**：一个由 Statistic 指标卡组成的 Grid（每张指标卡一个 Panel），下面是图表的 Grid。图表自己就是卡片，不要再放进 Panel（必须放在 Panel 中时加 `plain`）。

## 状态

| 状态 | 组件 | 说明 |
| --- | --- | --- |
| 页面首次加载 | PageSkeleton（`variant`：`list`、`detail`、`split`） | 形状与最终页面一致。 |
| 局部的短暂加载（抽屉、对话框、面板、主从分栏的一侧） | Loading（`fill` 在区域中居中） | 整个页面用 PageSkeleton。 |
| 页面的一部分在加载 | Skeleton | 它自己没有延迟：通过 useDelayedPending 挂载（见下文）。 |
| 刷新（翻页、搜索、筛选、排序） | 保留旧数据；DataTable、图表、Statistic 的 `loading` | 行或图形保留，加载指示 200ms 后才出现。 |
| 没有数据 | EmptyState（面板与列表中用 `size="sm"`；DataTable 用 `empty`） | 说明为什么是空的，在 `action` 中给出下一步。搜索没有结果时说明这一点，并提供清除筛选。 |
| 加载失败 | 带 `onRetry` 的 ErrorState；DataTable 与图表接收 `error`、`onRetry` | `message` 是给用户看的文字，不是原始异常。 |
| 提交中 | Button 的 `loading`、Modal 的 `okLoading` | 防止重复提交；宽度不变。 |
| 操作结果 | `useMessage()`：`success`、`error`、`info`、`warning`、`loading` | 简短；最多同时 3 条；同一个 `key` 原地更新。 |
| 可恢复的操作（归档、移出、移到回收站） | `useMessage().undoable({ content, onUndo })` | 直接执行并提供「撤销」（6 秒），不弹确认。 |
| 不能操作（没有权限、没有选择） | Button、IconButton、LinkButton、PromptInput 的 `disabled` 加 `disabledReason` | 悬停与键盘聚焦时显示原因，读屏也能读到。 |
| 不可恢复的操作（删除、清除数据） | `useConfirmDanger()`，用 `confirmText` 要求输入对象名称 | 焦点先在「取消」上；有 `confirmText` 时，输入名称之前「确认」不可用。 |
| 触发元素旁的轻量确认 | Popconfirm（`okTone="danger"`） | 影响较小的操作，如移除一项授权。 |
| 开关的修改失败 | Switch 的 `checked` 立即更新，失败时回滚并 `message.error` | 立即生效的设置用 Switch；用按钮保存的设置用表单控件。 |
| 流式出现的回复 | Message 的 `status`：`streaming`、带 `onRetry` 的 `error`、`stopped` | 还没有内容的流式回复在 200ms 后显示「正在生成」。 |

### 不闪

- PageSkeleton、Loading、DataTable 的 `loading`、图表与 Statistic 的加载、Message 的 `status="streaming"` 挂载后先保持不可见，200ms 后才淡入：很快完成的加载什么也不显示。不要再自己加延迟。
- `useDelayedPending(pending)` 在 `pending` 持续 200ms 后才变为 true，变为 true 后至少保持 400ms，已经出现的骨架不会一闪而过。首次加载时把 `isPending` 也放进条件：骨架立即挂载，它自带的延迟淡入与这个 hook 一起生效。

  ```tsx
  const showSkeleton = useDelayedPending(query.isPending)
  if (query.isPending || showSkeleton) return <PageSkeleton />
  ```

- 刷新时保留旧数据，只在 hook 为 true 时在上面叠加载指示；传 `immediate`，避免再延迟一次。

  ```tsx
  const showLoading = useDelayedPending(query.isFetching)
  {showLoading && <Loading immediate />}
  ```

- Skeleton 没有延迟：只在 `useDelayedPending` 为 true 时渲染。

## 文字、数字与时间

- **编号、代码、路径、接口名**：`<Text mono>`。
- **金额、数量、计数**：用等宽数字，列才能对齐：`<Text numeric>`、Input 的 `numeric`。DataTable 的单元格与 InputNumber 已经是等宽数字；数字列用 `align: 'end'` 对齐。
- **时间**：`<Text as="time" dateTime="2026-11-07T14:30:00Z" numeric>Nov 7, 2:30 PM</Text>`。用 `Intl.DateTimeFormat` 格式化；不含时间的日期按 UTC 格式化，才不会差一天。
- **金额与精确小数**：从接口到界面再回到接口，始终是十进制字符串（`"1280.50"`）。用 `<InputNumber decimal>` 编辑，它的值、`min`、`max`、`step` 都是字符串。用 `Intl.NumberFormat` 格式化，它接受十进制字符串：`money.format(amount as Intl.StringNumericLiteral)`。永远不要对金额 `parseFloat`。图表与 Statistic 接收 number：它们显示的是便于阅读的约数，不是用来计算的金额。
- **组件库自身的文字**（空状态、「重试」「撤销」、选择器的文字）随 ThemeProvider 的 `locale` 切换；你自己的文字来自应用的翻译。
- **错误**：先把错误转换成给用户看的文字，再交给 ErrorState、`error` 参数或 `message.error`。

## 禁止事项

- 为了搭界面而导入 `antd`、`@ant-design/*`、`dayjs`、`lucide-react`：需要的都由 `vellum-ui` 导出（图标用 Icon 按名称引用）。
- 给组件传 `style` 或 `className`，或者在组件外面包只为了加样式的元素。
- 重新实现组件库已有的组件（列表行、徽标、空状态、表格、对话框）。
- 把颜色、字号、间距、圆角、阴影、时长写成字面量。
- 同一个含义用两种样式（一个状态这里用 Pill，那里用彩色文字）。
- 一个区域中放多个主按钮。
- 为可恢复的操作弹确认框。
- 显示原始异常文本。
- 按 antd 的属性写（`type="primary"`、`danger`、`htmlType`、`mode="multiple"`、dayjs 值等）：见[如果你熟悉 Ant Design](conventions.md#如果你熟悉-ant-design)。

## 提交前检查

- [ ] 根元素是 Page（全屏界面是贴边的 SplitView）；没有自己写的标题行、工具栏、分栏。
- [ ] 没有新增 CSS；如果有，只是业务特有的视觉，并且符合[自定义样式](custom-styles.md)。
- [ ] 每个会加载的区域都有加载、空、错误状态，而且都不闪。
- [ ] 提交按钮显示 `loading`；禁用的操作说明原因（`disabledReason`）。
- [ ] 可恢复的操作提供「撤销」；不可恢复的操作用 `useConfirmDanger`。
- [ ] 图标按钮有 `label`；没有可见标签的控件有 `aria-label`；表格有 `aria-label`。
- [ ] 编号用 `mono`，金额是十进制字符串并用 `numeric`，时间用 `as="time"`。
- [ ] 没有残留 antd 的写法（[接口约定](conventions.md)）；类型检查通过。
- [ ] 在浅色、深色模式与紧凑密度下看过效果。

## 页面配方

遵循本指南的完整页面。每个配方是 `vellum-ui/examples/recipes/` 中的一个文件，只从 `vellum-ui` 与 `react` 导入，数据在本地模拟（包括一个可以看到的错误状态），可以直接运行。

| 配方 | 展示的内容 |
| --- | --- |
| [ListPage](../recipes/ListPage.md) | Page、带搜索、筛选、服务端排序、分页、多选与批量操作的 DataTable；加载、空、错误状态 |
| [DetailPage](../recipes/DetailPage.md) | 标题与操作（含「更多」菜单）、Descriptions、量表、各自加载的 Tabs；撤销与危险确认 |
| [MasterDetail](../recipes/MasterDetail.md) | 可搜索的 ListItem 列表与 SplitView；右侧的未选择、加载、空、错误状态 |
| [SettingsPage](../recipes/SettingsPage.md) | SettingRow 中的 Switch（乐观更新，失败回滚）、用按钮保存的 InputNumber 与 Select；危险操作区 |
| [FormDialog](../recipes/FormDialog.md) | 带 Form 的 Modal：校验规则、异步校验、日期；`okLoading` 与成功消息 |
| [Dashboard](../recipes/Dashboard.md) | Grid 中的 Statistic 指标卡、LineChart、BarChart、DonutChart、SegmentedBar，各自有加载与错误状态 |
| [ChatPage](../recipes/ChatPage.md) | MessageList、Message、MessageActions、PromptInput、PromptSuggestions，以及以 Markdown 流式出现的回复 |
