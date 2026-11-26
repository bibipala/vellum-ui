/**
 * vellum-ui/ai —— AI 对话与流式输出的组件与工具：MessageList、Message、MessageActions、PromptInput、PromptSuggestions、
 * Reasoning、ToolCalls、Sources、Citation、StreamingText、Markdown，以及 useStream、readSSE、readTextStream。
 *
 * Markdown 需要使用方安装 @ant-design/x-markdown（可选的 peer 依赖，只有本入口用到）；渲染器在第一次渲染时按需加载。
 * 本入口与核心入口共用同一份模块（主题上下文、令牌、组件）：发布产物中它按相对路径导入核心模块，不另带一份副本。
 */

export { Markdown, type MarkdownProps } from './components/ai/Markdown.tsx'
export {
  Message,
  type MessageAuthor,
  type MessageProps,
  type MessageStatus,
} from './components/ai/Message.tsx'
export {
  MessageActions,
  type MessageActionsProps,
  type MessageFeedback,
} from './components/ai/MessageActions.tsx'
export {
  MessageList,
  type MessageListHandle,
  type MessageListProps,
} from './components/ai/MessageList.tsx'
export {
  PromptInput,
  type PromptInputHandle,
  type PromptInputProps,
  type PromptInputRejectReason,
  type PromptInputSubmit,
} from './components/ai/PromptInput.tsx'
export {
  type PromptSuggestion,
  PromptSuggestions,
  type PromptSuggestionsProps,
} from './components/ai/PromptSuggestions.tsx'
export { Reasoning, type ReasoningProps } from './components/ai/Reasoning.tsx'
export {
  Citation,
  type CitationProps,
  type SourceItem,
  Sources,
  type SourcesProps,
} from './components/ai/Sources.tsx'
export { StreamingText, type StreamingTextProps } from './components/ai/StreamingText.tsx'
export {
  type ReadStreamOptions,
  readSSE,
  readTextStream,
  type ServerSentEvent,
  StreamResponseError,
  type StreamSource,
} from './components/ai/stream.ts'
export {
  type ToolCallItem,
  type ToolCallStatus,
  ToolCalls,
  type ToolCallsProps,
} from './components/ai/ToolCalls.tsx'
export {
  type StreamState,
  type StreamStatus,
  type UseStreamOptions,
  useStream,
} from './components/ai/useStream.ts'
