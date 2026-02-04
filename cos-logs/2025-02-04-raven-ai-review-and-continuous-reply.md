# Raven AI 功能完整审查与「Bot 不能连续回复」原因分析

**日期**: 2025-02-04

---

## 一、Bot「不能连续回复」的原因

### 1. 设计上：一次请求只发一条回复

- **流程**：用户发一条消息 → 触发一次 AI 请求（`handle_ai_request_sync`）→ 得到**一个** `response["response"]` → **一次** `bot.send_message(channel_id, text=response["response"])`。
- **结论**：同一轮对话里，Bot **不会**先发「正在查询…」再发「结果」两条消息；只会发**一条**最终回复。  
- 「Raven AI is thinking…」是前端通过 `ai_event` 的实时状态展示，不是写入库的 Raven Message；结束后会用 `ai_event_clear` 清掉，并只发一条 Bot 消息。
- 若用户期望「先一条等待，再一条数据」，需要产品上改为：要么接受「一条合并回复」，要么在后端实现「先发一条占位消息，再在工具回调里更新/补发一条」（当前未实现）。

### 2. 已修复：历史消息取错导致「像没连续回复」

- **问题**：在已有线程里取 `conversation_history` 时，用了 `order_by="creation asc"` 且 `limit=20`，拿到的是**最早** 20 条，而不是**最近** 20 条。
- **后果**：当线程里超过 20 条消息时，当前这条用户消息根本不在列表里；被排除的是「第 20 条旧消息」而不是「当前消息」。历史错位，模型上下文不包含最近几轮对话，表现上就像「没理解上文 / 不能连续回复」。
- **修复**（`raven/ai/ai.py`）：
  - 改为 `order_by="creation desc"`、`limit=20`，得到最近 20 条；
  - 在内存中 `reversed(messages)` 恢复成时间正序；
  - 再用 `messages[:-1]` 排除当前这条（即最新一条），得到正确的「最近 19 条历史 + 当前 1 条」。
- **验收**：在已有 20+ 条消息的线程里再发一条，Bot 的回复应明显基于最近几轮对话，而不是「忘了上文」。

### 3. 其他可能影响「连续感」的点

- **空回复**：若模型/工具返回空，之前会出现「No response content.»」或只显示「正在查询…」无下文；已通过「工具结果兜底」「空 final_output 兜底」和「FAC 强制 fallback + 明确 call_fac_tool 指令」缓解。
- **错误未抛出**：若 `handle_ai_request_sync` 或 `process_message_with_agent` 里异常被吞掉，会表现为「没任何回复」；当前异常会进 Error Log（"Raven AI"）并给用户发错误提示，可据此排查。
- **队列/超时**：AI 处理通过 `frappe.enqueue(..., timeout=600)` 执行；若任务超时或队列堆积，可能表现为「很久才回」或「不回」；可查队列与超时配置。

---

## 二、Raven AI 功能完整实现审查

### 1. 入口与路由

| 场景 | 入口 | 实现 |
|------|------|------|
| 用户给 Bot 发 DM（新会话） | `RavenMessage.after_insert` → `handle_ai_message` → `handle_bot_dm` | ✅ `handle_bot_dm` 根据 `model_provider` 走 Agents 或 Assistants；Agents 下创建 thread channel，发 `ai_event`，调 `process_message_with_agent(..., is_new_conversation=True)` |
| 用户在已有 AI 线程里发消息 | `handle_ai_message` → `handle_ai_thread_message` | ✅ 取 `channel.thread_bot`，发 `ai_event`，调 `process_message_with_agent(..., is_new_conversation=False, channel=channel)` |
| 历史上下文 | `process_message_with_agent` 内 | ✅ 当 `not is_new_conversation and channel` 时从该 channel 取消息建 `conversation_history`；**已修复为取最近 20 条并排除当前条** |

### 2. 请求与模型

| 项目 | 实现 |
|------|------|
| 同步调用 | ✅ `handle_ai_request_sync` 用 `asyncio.run_until_complete(handle_ai_request_async(...))` 包装异步 |
| 模型与客户端 | ✅ `RavenAgentManager._setup_client` 按 `model_provider`（OpenAI / Local LLM）建 AsyncOpenAI、OpenAIProvider |
| 工具注入 | ✅ CRUD 工具、可选 Code Interpreter / File Search、FAC 同进程 `call_fac_tool`（条件：enable_fac_integration、In-process、OpenAI、已安装 FAC） |
| FAC 路径 | ✅ 有 FAC 工具时强制走「直接 API」fallback，由我们执行 tool_calls 并做第二轮请求；空 content 时用工具结果格式化回复 |

### 3. 回复与错误

| 项目 | 实现 |
|------|------|
| 成功时发一条消息 | ✅ `process_message_with_agent` 中 `if response["success"] and response["response"] is not None: bot.send_message(...)` |
| 失败时提示 | ✅ `else` 分支发统一错误文案；若 `bot.debug_mode` 则附带 `response["error"]` |
| 异常 | ✅ `try/except` 写 Error Log（"Raven AI"）并给用户发错误提示，再 `ai_event_clear` |
| 空回复兜底 | ✅ `agents_integration` 中 `final_output` 为空时用固定提示；fallback 路径下模型第二轮空 content 时用 `_format_tool_results_as_response` 作为回复 |

### 4. 对话历史格式

| 项目 | 实现 |
|------|------|
| 传给 SDK 的格式 | ✅ `handle_ai_request_async` 中把 `conversation_history` 转成 `input_items`（role + content），最后一项为当前 `message`；无历史时 `full_input = message` |
| Fallback 消息数组 | ✅ 先 system，再按 history 逐条 user/assistant，最后一条 user 为当前消息；工具回合时追加 assistant（含 tool_calls）和 tool 结果，再请求第二轮 |

### 5. 文件与附件

| 项目 | 实现 |
|------|------|
| 近期文件合并 | ✅ 文本消息若 30 秒内有同用户文件/图片，会合并进同一请求（`recent_file_message`） |
| 纯文件无文字 | ✅ 不立刻触发 AI，等用户补文字再处理 |
| 文件内容提取 | ✅ `extract_file_content_for_agent`（Google Document AI 或基础提取），结果拼进 `content` |
| 历史中的文件 | ✅ 不再次提取内容，仅以占位描述 `[User uploaded a file/image: ...]` 进 conversation_history |

### 6. 未实现 / 与「连续回复」相关的设计选择

- **同一轮多条 Bot 消息**：未实现「先发一条占位，再发一条结果」；始终一条请求一条回复。
- **流式输出**：Agents 路径下未做流式；Assistants 路径有 `stream_response`。
- **Runner.run 与 FAC**：有 FAC 时已强制走 fallback，不再依赖 Runner.run 的多轮；避免 Runner 只回首轮「正在查询…」无数据的问题。

---

## 三、小结与建议

1. **「不能连续回复」**  
   - 若指「同一轮先一条等待再一条结果」：当前设计就是**单条最终回复**，如需两条需改产品与实现。  
   - 若指「第二句、第三句用户消息没被正确接上」：已通过**修正 conversation_history 为最近 20 条并排除当前条** 修复，请验证多轮对话。

2. **Raven AI 功能**  
   - 入口、路由、历史、工具（含 FAC）、错误与空回复兜底均按上述实现；**唯一已发现并修复的 bug 是历史消息取成「最早 20 条」**。

3. **建议验证**  
   - 在已有 20+ 条消息的 AI 线程里再发 1～2 条，确认回复是否紧扣最近几轮。  
   - 发「查一下最近 5 条 Sales Order」类请求，确认能拿到 FAC 工具结果且不再出现「No response content.»」或只显示「正在查询…」无下文。
