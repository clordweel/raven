# FAC 正确调用 call_fac_tool 而非 frappe.get_list 的修复

**日期**: 2025-02-04

## 现象

- 用户发「查一下最新的一条销售订单」时，Bot 回复中出现「尝试调用 frappe.get_list」并报错「frappe.get_list 未注册或不可用」。
- 说明模型没有正确使用 FAC 的 `call_fac_tool`，而是输出了一段「调用 frappe.get_list」的文本，或模型发起了不存在的工具调用。

## 原因分析

1. **Fallback 中 call_fac_tool 可能未进入 tools 列表**  
   构建 `tools_param` 时仅当 `hasattr(tool, "params_json_schema")` 才加入。若 agents SDK 的 `function_tool` 使用其他属性（如 `parameters`）或某版本未暴露 schema，`call_fac_tool` 会被跳过，模型收不到该工具定义，就会编造「frappe.get_list」或只输出文字描述。

2. **模型被训练成优先想到 frappe.get_list**  
   未在指令中明确禁止「输出/描述调用 frappe.get_list」或「说工具不可用」时，模型可能用自然语言描述一次调用并报错，而不是实际发起 `call_fac_tool`。

## 修改说明

**文件**: `raven/ai/agents_integration.py`

### 1. Fallback 中保证 call_fac_tool 一定在 tools_param 中

- 构建 `tools_param` 时：
  - 除 `params_json_schema` 外，也接受 `getattr(tool, "parameters", None)`，避免因属性名不同而漏掉工具。
  - 若存在 `_fac_tools_list` 且当前 `tools_param` 里没有名为 `call_fac_tool` 的 function，则**手动追加**一条 OpenAI function 格式的 `call_fac_tool` 定义（含 `name`、`description`、`parameters`），参数为 `tool_name`（string）、`arguments`（string，JSON 字符串）。这样无论 SDK 是否暴露 schema，请求里都会带上 `call_fac_tool`。

### 2. 强化指令：禁止 frappe.get_list，必须用 call_fac_tool

- 在 **fallback** 的 `enhanced_instructions` 中（当有 FAC 时）：
  - 明确：列出/查询数据时必须**使用 function call_fac_tool**；**不得**输出 JSON 或文字描述「调用 frappe.get_list」；**不得**说「frappe.get_list 未注册」或「工具不可用」。
  - 强调：列出 ERPNext/Frappe 数据的**唯一方式**是调用工具 `call_fac_tool`，且 `tool_name='list_documents'`，`arguments` 为 JSON 字符串（含 doctype、limit 等）。
  - 保留并微调「查一下最新的一条销售订单」/「查一下最近 5 条 Sales Order」的示例，对应 `arguments='{"doctype": "Sales Order", "limit": 1}'` 或 `limit=5`。

- 在 **主路径** `create_agent` 的 FAC 说明（`fac_instruction`）中：
  - 增加一句：不得输出或描述调用 frappe.get_list；不得说工具不可用或不熟悉 SQL。

## 验收

- 发「查一下最新的一条销售订单」或「查一下最近 5 条 Sales Order」：
  - Bot 应**实际发起**对 `call_fac_tool` 的调用（tool_name=`list_documents`，arguments 含 doctype、limit），并返回 FAC 查到的数据。
  - 不应再出现「frappe.get_list 未注册或不可用」或仅输出一段「尝试调用 frappe.get_list」的 JSON/文字。
