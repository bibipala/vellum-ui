/**
 * Built-in texts: English (the default language). Every key here must also exist in the other built-in
 * languages (`zh-CN.ts`); the type of the other language packs is derived from this file.
 * The keys are part of the public API, the texts are not (values are typed as plain strings).
 */
/** Freezes a text table and keeps only its keys in the type (changing a text is not an API change). */
const define = <K extends string>(texts: Record<K, string>): Readonly<Record<K, string>> =>
  Object.freeze(texts)

/** English texts (the default language). */
export const enUS = define({
  'theme.default': 'Vellum',
  'colorMode.light': 'Light',
  'colorMode.dark': 'Dark',
  'colorMode.system': 'System',
  'empty.description': 'No data',
  'spin.loading': 'Loading',
  'error.title': 'Failed to load',
  'error.retry': 'Retry',
  'confirm.ok': 'Confirm',
  'confirm.cancel': 'Cancel',
  'confirm.typeToConfirm': 'Type "{name}" to confirm',
  // IconButton disabled with a reason: the button label followed by the reason
  'iconButton.disabledTooltip': '{label}: {reason}',
  // useMessage: accessible name of the message region; the button of an undoable message
  'message.region': 'Notifications',
  'message.undo': 'Undo',
  'imageGrid.empty': 'No images yet',
  'imageGrid.label': 'Image grid',
  'lightbox.label': 'Image viewer',
  'lightbox.close': 'Close',
  'lightbox.prev': 'Previous',
  'lightbox.next': 'Next',
  'lightbox.stage': 'Background',
  'lightbox.stage.mid': 'Gray',
  'lightbox.stage.dark': 'Dark gray',
  'lightbox.stage.black': 'Black',
  'lightbox.counter': '{current} / {total}',
  // Upload: drop area texts, the file list and its actions
  'upload.dropzone.title': 'Drag files here, or click to choose',
  'upload.dropzone.drop': 'Drop to add the files',
  'upload.list': 'Files',
  'upload.failed': 'Upload failed',
  'upload.retry': 'Retry',
  'upload.remove': 'Remove',
  'breadcrumb.label': 'Breadcrumb',
  'colorPicker.label': 'Color',
  'image.error': 'Failed to load',
  // StatusDot without aria-label: a generic name per tone; the caller supplies the real meaning
  'statusDot.success': 'OK',
  'statusDot.warning': 'Attention',
  'statusDot.danger': 'Error',
  'statusDot.neutral': 'Inactive',
  'statusDot.accent': 'Notice',
  // CopyButton: default label, and the text shown and announced after copying
  'copy.copy': 'Copy',
  'copy.copied': 'Copied',
  'copy.failed': "Couldn't copy",
  // Kbd: the visible text of the space bar, and what screen readers read for key symbols
  'kbd.space': 'Space',
  'kbd.command': 'Command',
  'kbd.control': 'Control',
  'kbd.option': 'Option',
  'kbd.shift': 'Shift',
  'kbd.enter': 'Enter',
  'kbd.backspace': 'Backspace',
  'kbd.delete': 'Delete',
  'kbd.tab': 'Tab',
  'kbd.up': 'Up arrow',
  'kbd.down': 'Down arrow',
  'kbd.left': 'Left arrow',
  'kbd.right': 'Right arrow',
  // Splitter: accessible name of the handle
  'splitter.label': 'Resize',
  // CommandPalette
  'commandPalette.label': 'Command palette',
  'commandPalette.placeholder': 'Search or run a command',
  'commandPalette.results': 'Results',
  'commandPalette.empty': 'No results',
  'commandPalette.more': '{count} more results. Keep typing to narrow them down.',
  'commandPalette.searching': 'Searching',
  'commandPalette.searchFailed': "Couldn't load more results",
  'commandPalette.navigate': 'Navigate',
  'commandPalette.select': 'Open',
  'commandPalette.close': 'Close',
  // CommandPalette: descriptions of its keys in the list of registered hotkeys (useRegisteredHotkeys)
  'commandPalette.hotkey.close': 'Close the command palette',
  'commandPalette.hotkey.move': 'Move through the results',
  'commandPalette.hotkey.open': 'Open the selected result',
  // Numbers in charts and figures: the BCP 47 tag passed to Intl.NumberFormat; the text of a missing value
  'format.locale': 'en-US',
  'format.missing': '—',
  // Charts: the series or slice that groups everything past the color limit
  'chart.other': 'Other',
  // Sparkline: the accessible name, a summary of the line ({label} is the label given by the application)
  'sparkline.summary': '{label}: from {start} to {end}, low {min}, high {max}',
  'sparkline.single': '{label}: {value}',
  'sparkline.empty': '{label}: no data',
  // Statistic: the change read by screen readers ("Up 12.5%, vs last month"), and the name of the trend line
  'statistic.up': 'Up {value}',
  'statistic.down': 'Down {value}',
  'statistic.flat': 'No change',
  'statistic.delta': '{change}, {period}',
  'statistic.trend': '{label} trend',
  // SegmentedBar: the accessible name of a part, and the text of a bar without data
  'segmentedBar.part': '{name}: {value} ({share})',
  'segmentedBar.empty': 'No data',
  // Charts: the switch between the graphic and its table, the legend, the empty state
  'chart.view.label': 'View',
  'chart.view.chart': 'Chart',
  'chart.view.table': 'Table',
  'chart.legend': 'Legend',
  'chart.empty': 'No data',
  // Charts: what screen readers read for the focusable graphic, and the keys it understands
  'chart.kind.line': 'Line chart',
  'chart.kind.area': 'Area chart',
  'chart.kind.bar': 'Bar chart',
  'chart.kind.pie': 'Pie chart',
  'chart.kind.donut': 'Donut chart',
  'chart.kind.scatter': 'Scatter chart',
  'chart.kind.heatmap': 'Heatmap',
  'chart.kind.custom': 'Chart',
  'chart.keys':
    'Use the arrow keys to move between values and Esc to hide the details. The table view lists every value.',
  'chart.keys.grid':
    'Use the arrow keys to move between cells and Esc to hide the details. The table view lists every value.',
  // Charts: headers of the table view
  'chart.table.category': 'Category',
  'chart.table.value': 'Value',
  'chart.table.share': 'Share',
  'chart.table.series': 'Series',
  'chart.table.label': 'Label',
  // Heatmap: the color scale under the cells
  'chart.scale': 'Color scale from {min} to {max}',
  'chart.scale.diverging': 'Color scale from {min} to {max}, centered on {mid}',
  // AI and streaming (M4): Markdown. Read after an external link by screen readers; the text of an image that is
  // not loaded and has no alternative text; the accessible name of a table that scrolls horizontally
  'markdown.newTab': 'opens in a new tab',
  'markdown.image': 'Image',
  'markdown.table': 'Table',
  // Reasoning: the header while thinking and after it ({duration} is written with reasoning.seconds / minutes)
  'reasoning.thinking': 'Thinking',
  'reasoning.done': 'Thought for {duration}',
  'reasoning.process': 'Thought process',
  'reasoning.seconds': '{seconds}s',
  'reasoning.minutes': '{minutes}m {seconds}s',
  // ToolCalls: the status of a step (always shown next to its icon), and the titles of its details
  'toolCalls.pending': 'Waiting',
  'toolCalls.running': 'Running',
  'toolCalls.success': 'Done',
  'toolCalls.error': 'Failed',
  'toolCalls.cancelled': 'Cancelled',
  'toolCalls.input': 'Input',
  'toolCalls.output': 'Output',
  // Sources: the collapsed header of the list; Citation: what screen readers read for a marker
  'sources.one': '1 source',
  'sources.other': '{count} sources',
  'citation.label': 'Source {index}: {title}',
  // AI conversation (M4c): MessageList, Message, MessageActions, PromptInput, PromptSuggestions
  'messageList.label': 'Conversation',
  'messageList.latest': 'Back to latest',
  'messageList.newMessages': '{count} new',
  'messageList.loadingEarlier': 'Loading earlier messages',
  'message.user': 'You',
  'message.assistant': 'Assistant',
  'message.generating': 'Generating',
  'message.failed': "Couldn't generate a reply",
  'message.retry': 'Retry',
  'message.stopped': 'Stopped',
  'messageActions.label': 'Message actions',
  'messageActions.retry': 'Retry',
  'messageActions.like': 'Like',
  'messageActions.dislike': 'Dislike',
  'promptInput.label': 'Message',
  'promptInput.placeholder': 'Type a message',
  'promptInput.send': 'Send',
  'promptInput.stop': 'Stop generating',
  'promptInput.attach': 'Attach files',
  'promptInput.attachments': 'Attachments',
  'promptInput.remove': 'Remove {name}',
  'promptInput.drop': 'Drop files to attach',
  'promptSuggestions.label': 'Suggestions',
  // Data tables (M5b): InlineEdit. The accessible name of the value ("Edit Name"), the text of an empty value, the
  // error shown when saving fails, and the range errors of numbers ({min} and {max} are written for the locale)
  'inlineEdit.edit': 'Edit {label}',
  'inlineEdit.empty': 'Not set',
  'inlineEdit.saveFailed': "Couldn't save. Try again.",
  'inlineEdit.range': 'Enter a number from {min} to {max}',
  'inlineEdit.min': 'Enter a number of at least {min}',
  'inlineEdit.max': 'Enter a number of at most {max}',
  // SelectionBar: the accessible name of the bar, the count, "Select all", the clear button, and what screen
  // readers hear when the selection is cleared
  'selectionBar.label': 'Bulk actions',
  'selectionBar.selected': '{count} selected',
  'selectionBar.allSelected': 'All {count} selected',
  'selectionBar.selectAll': 'Select all {total}',
  'selectionBar.clear': 'Clear selection',
  'selectionBar.cleared': 'Selection cleared',
  // Data table (M5): the checkboxes of the selection column ({name} is the row label), the resize handle of a
  // column header, and the column settings (button, title, moving, pinning, restoring the defaults)
  'dataTable.select': 'Select',
  'dataTable.selectAll': 'Select all rows',
  'dataTable.selectRow': 'Select {name}',
  'dataTable.resize': 'Resize {column}',
  'dataTable.columns': 'Columns',
  'dataTable.columns.list': 'Shown columns',
  'dataTable.columns.moveUp': 'Move {column} up',
  'dataTable.columns.moveDown': 'Move {column} down',
  'dataTable.columns.pinStart': 'Pin {column} to the start',
  'dataTable.columns.pinEnd': 'Pin {column} to the end',
  'dataTable.columns.alwaysShown': 'Always shown',
  'dataTable.columns.lastShown': 'At least one column is shown',
  'dataTable.columns.reset': 'Restore defaults',
})
