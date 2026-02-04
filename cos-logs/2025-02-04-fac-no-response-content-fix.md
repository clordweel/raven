# FAC 整合「No response content.」与空回复修复

**日期**: 2025-02-04

## 现象

- 用户在与 Raven Bot（OpenAI + FAC 整合）对话时，发送「查一下最近5条 Sales Order」等指令。
- 第一次回复直接出现 **「No response content.»**。
- 后续多轮对话中，Bot 会表示「正在查询中...」但始终不返回实际 Sales Order 数据。

## 原因分析

1. **工具执行后模型返回空 content**  
   在「直接 API」fallback 路径中：先发一轮带 tools 的请求 → 模型返回 tool_calls（如 `call_fac_tool`）→ 执行工具得到结果 → 再发第二轮请求（仅 messages，不带 tools）让模型根据工具结果生成回复。部分模型在第二轮会返回空的 `message.content`，前端因此显示「No response content.»」。

2. **主路径 `result.final_output` 为空**  
   使用 Runner.run 时，若最后一轮只有工具调用、没有文本输出，`result.final_output` 可能为 None/空，前端同样会显示空或「No response content.»」。

## 修改说明

**文件**: `raven/ai/agents_integration.py`

1. **Fallback 路径**  
   - 在第二轮 API 返回后，若 `raw_response` 为空/仅空白，且存在 `tool_results`，则用工具结果生成可读回复，不再显示「No response content.»」。  
   - 新增 `_format_tool_results_as_response(tool_results)`：将工具返回的 JSON（含 FAC 的 list/result）格式化为简短列表（如 `• name` 或键值），便于用户直接看到查询结果。  
   - 新增 `_format_single_item(item)`：单条记录格式化为一行的辅助函数。

2. **主路径**  
   - 在取 `result.final_output` 后，若为空或仅空白，则使用兜底文案：  
     `No response content from the model. Try rephrasing or check tool results in Error Log.`  
   - 避免向前端返回 None/空字符串导致界面显示异常。

**翻译**: 在 `raven/translations/zh.csv` 中补充上述兜底文案及「… and {0} more.» 的中文译文。

## 验收

- 发送「查一下最近5条 Sales Order」等会触发 FAC 工具的指令时：  
  - 若模型第二轮返回空 content，用户应看到由工具结果格式化后的列表（如订单/文档名称等），而不再是「No response content.»」。  
- 主路径下若 `final_output` 为空，用户应看到上述兜底提示，而不是完全空白。

---

## 补充：回复「等待」后无后续消息（2025-02-04）

### 现象

- Error Log 无相关报错；Bot 先回复「正在查询… / Please wait a moment」后，没有第二条消息返回数据。

### 原因

1. **主路径 Runner.run**：当模型第一轮返回「I'm fetching...」并附带 tool_calls 时，Runner 可能只执行一轮就把首轮文本当作 `final_output` 返回，未执行工具并做第二轮，或第二轮未正确聚合到 `final_output`。  
2. **模型未调工具**：首轮只返回「正在查询…」文字、未附带 tool_calls，则后端只返回该条消息，自然无后续数据。

### 修改

**文件**: `raven/ai/agents_integration.py`

1. **FAC 启用时强制走 fallback 路径**  
   - 在调用 `Runner.run` 前，若 `manager._fac_tools_list` 非空，则抛出 `TypeError("Force fallback for FAC tool calls")`，进入「直接 API」fallback。  
   - Fallback 中由我们控制：第一轮带 tools → 若有 tool_calls 则执行工具 → 第二轮带工具结果 → 返回第二轮内容或格式化后的工具结果（含此前「空 content 用工具结果」逻辑）。  
   - 这样 FAC 相关请求一定走「发请求 → 执行 tool_calls → 第二轮请求」的流程，避免 Runner 只返回首轮「等待」而不执行工具或不做第二轮。

2. **Fallback 中加强「必须先调用工具」的指令**  
   - 当 `manager._fac_tools_list` 非空时，在 `enhanced_instructions` 后追加：  
     - 当用户要求列出/查询/获取数据（如 Sales Order、Customer、list documents）时，必须先调用 `call_fac_tool`，并传入正确的 `tool_name` 和 `arguments`（JSON）；不得仅回复「I am fetching」或「please wait」而不发起工具调用。  
   - 减少模型只回复「等待」却不发 tool_calls 的情况。

### 验收

- 发送「查一下最近5条 Sales Order」：  
  - 应走 fallback 路径；若模型首轮返回 tool_calls，会执行 FAC 工具并做第二轮，用户应看到数据或格式化后的工具结果。  
  - 若模型首轮仍只回复「等待」，因指令已加强，后续测试中应更常出现首轮即带 tool_calls 的行为。
