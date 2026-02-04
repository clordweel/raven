# Raven 接入 Frappe Assistant Core (FAC) 整合方案

**日期**: 2025-02-04  
**参考**: [Frappe Assistant Core](https://github.com/buildswithpaul/Frappe_Assistant_Core)

---

## 1. 现状简述

### 1.1 Git 状态
- 当前分支 `cos-dev`，工作区干净，**无待提交更改**。

### 1.2 FAC 能力概览
- **定位**: 通过 MCP (Model Context Protocol) 把 ERPNext/Frappe 能力暴露给任意兼容 LLM。
- **MCP 端点**: `POST /api/method/frappe_assistant_core.api.fac_endpoint.handle_mcp`
- **认证**: OAuth 2.0 Bearer Token（用户登录后授权，FAC 使用 Frappe OAuth）。
- **能力**: 20+ 内置工具（文档 CRUD、搜索、报表、数据分析、Python 执行、可视化等），支持插件与外部应用通过 `assistant_tools` 钩子注册自定义工具。

### 1.3 Raven 现有 AI 架构
- **入口**: `raven_message.after_insert` → `handle_ai_message` → AI Thread 或 DM to Bot。
- **执行**: `raven.ai.ai` → `handle_bot_dm_with_agents` / `handle_bot_dm_with_assistants`，主路径使用 **OpenAI Agents SDK**。
- **工具来源**: `create_raven_tools(bot)`（Raven AI Function + bot_functions），可选 FileSearch、CodeInterpreter；**未接入任何 Hosted MCP**。
- **HostedMCPTool**: 仅在 `_filter_tools_for_provider` 中用于在 Local LLM 下排除该类工具，**当前未从配置添加任何 MCP 服务**。

---

## 2. 整合方向（两路可选）

### 方案 A：Raven Bot 作为 MCP 客户端连接 FAC（推荐优先）

**目标**: 用户在 Raven 里与 Bot 对话时，Bot 除现有 Raven 工具外，还能调用 FAC 暴露的 ERPNext/报表等工具。

**要点**:
1. **配置**: 在 Raven Settings 或 Raven Bot 上增加“FAC 集成”开关及 MCP 端点 URL（可与站点 base URL 拼接为完整 `handle_mcp` 地址）。
2. **工具注入**: 在 `agents_integration.RavenAgentManager._setup_tools()` 中，若启用 FAC，则追加一个 `HostedMCPTool`，指向 FAC 的 Streamable HTTP MCP 端点。
3. **认证**: FAC 要求 OAuth Bearer 或 Frappe 标准认证。**首版采用单用户认证**，Raven 服务端用同一凭证调用 FAC。可选实现：
   - **方案 A1（单用户 OAuth）**: 在 Raven Settings 中配置 **fac_bearer_token**（Password）：管理员从 MCP Inspector 等完成一次 OAuth 后粘贴 access_token，Raven 后端请求 FAC 时使用 `Authorization: Bearer <token>`。
   - **方案 A2（Frappe 用户 API Key）**: **实测支持**：使用 Frappe User 的 api_key:api_secret 作为认证头可通过 FAC 认证（Frappe 标准格式 `Authorization: token api_key:api_secret`，见 `frappe.auth.validate_auth_via_api_keys`）。在 Raven Settings 中配置 **fac_api_key**（Data）与 **fac_api_secret**（Password），Raven 后端请求 FAC 时使用 `Authorization: token api_key:api_secret`。无需每用户 OAuth 流程。
   - 后续可做“当前聊天用户”身份：每用户 OAuth 或按请求转发请求自带的 Bearer（见 [方案 A 落地问题分析](./2025-02-04-plan-a-issues-analysis.md) §5 Mobile 结合）。
4. **依赖**: 同一 bench 先安装并启用 `frappe_assistant_core`，Raven 仅作为 MCP 客户端调用其端点；可选通过 `install_app` 或文档声明“使用 FAC 集成时需安装 FAC”。

**实现步骤建议**:
1. 在 Raven Settings 增加：`enable_fac_integration`、`fac_mcp_endpoint_url`（或仅 `fac_base_url` 由代码拼接 `handle_mcp` 路径）。
2. 若采用 A2：增加 `fac_api_key` / `fac_api_secret`（或 password 字段）并在调用 FAC 时带 Authorization。
3. 在 `agents_integration.py` 的 `_setup_tools` 中：若 `enable_fac_integration` 且端点非空，则 `self.tools.append(HostedMCPTool(...))`，参数需与 OpenAI Agents SDK 的 HostedMCPTool 签名一致（URL、transport、auth）。若 SDK 的 HostedMCPTool 仅支持 URL + headers，则把 Bearer token 或 api_key 放进 headers。
4. 查清 OpenAI Agents SDK 中 `HostedMCPTool` 的构造函数（URL、Streamable HTTP、Bearer 等），按文档传入 FAC 端点与认证信息。
5. 保持对 Local LLM 的过滤逻辑不变（继续排除 HostedMCPTool），FAC 仅在 OpenAI 或“支持 Hosted MCP”的 provider 下生效。

#### 方案 A 落地实现步骤任务清单

| 序号 | 任务 | 说明 | 产出/验收 |
|------|------|------|-----------|
| A1 | 查清 HostedMCPTool 签名 | 查阅 `agents` 包文档或源码，确认是否支持 Streamable HTTP、如何传 URL / Base URL、如何传 Authorization（Bearer 或 headers） | 文档或注释：构造函数参数与用法 |
| A2 | Raven Settings 增加 FAC 配置项 | 新增 `enable_fac_integration`（Check）、`fac_mcp_endpoint_url`（Data，或 `fac_base_url` 由代码拼接 `handle_mcp` 路径） | Raven Settings 单页可配置并保存 |
| A3 | 单用户认证字段 | 新增 **fac_bearer_token**（Password，OAuth 粘贴）与 **fac_api_key**（Data）+ **fac_api_secret**（Password，Frappe User API Key），二选一配置 | 配置项存在且可安全存储 |
| A4 | 实现 FAC 认证逻辑 | 若配置 fac_bearer_token：`Authorization: Bearer <token>`。若配置 fac_api_key + fac_api_secret：`Authorization: token api_key:api_secret`。两者皆无则跳过注入 | 后端可返回用于请求 FAC 的 authorization/headers |
| A5 | 在 _setup_tools 中注入 HostedMCPTool | 在 `agents_integration.RavenAgentManager._setup_tools()` 中：若 `enable_fac_integration` 且端点非空，则 `self.tools.append(HostedMCPTool(...))`，传入 FAC 端点与认证信息（与 A1 一致） | Bot 使用 OpenAI 时 tools 列表包含 FAC MCP 工具 |
| A6 | 保持 Local LLM 过滤逻辑 | 确认 `_filter_tools_for_provider()` 在 Local LLM 下继续排除 HostedMCPTool，FAC 仅在 OpenAI（或支持 Hosted MCP 的 provider）下生效 | 本地模型下无 HostedMCPTool，无报错 |
| A7 | 可选依赖与运行时判断 | 用 `frappe.get_installed_apps()` 或 try/except import 判断 FAC 是否安装；未安装时跳过 FAC 相关逻辑，不报错 | 未安装 FAC 时 Raven 正常启动、Bot 可用 |
| A8 | 联调与验证 | 安装 FAC 后，在 Raven 内与 Bot 对话，触发调用 FAC 工具（如查 DocType、报表等），或用 MCP Inspector 验证端点与认证 | 能成功调用 FAC 工具并返回结果 |

**建议执行顺序**：A1 → A2 → A3（若选 A2 认证）→ A4 → A5 → A6 → A7 → A8。

---

### 方案 B：Raven 作为 FAC 的外部应用注册工具

**目标**: 让已连接 FAC 的 LLM（如 Claude Desktop、ChatGPT 等）能通过 FAC 调用 Raven 能力（查频道、查消息、发消息等）。

**要点**:
1. **FAC 机制**: 外部应用在 `hooks.py` 中通过 `assistant_tools` 注册工具类，FAC 扫描并纳入其 MCP 的 `tools/list`，供 LLM 调用。
2. **Raven 侧**: 在 Raven 中新增 `raven/assistant_tools/` 目录，实现继承自 `frappe_assistant_core.core.base_tool.BaseTool` 的工具类（例如：列出用户频道、获取频道消息、发送 Raven 消息等），在 `raven/hooks.py` 中声明 `assistant_tools = ["raven.assistant_tools.xxx.ChannelListTool", ...]`。
3. **依赖**: 安装 FAC 后，FAC 会扫描已安装 app 的 hooks；Raven 需将 `frappe_assistant_core` 列为可选依赖（或在文档中说明“FAC 集成需先安装 FAC”），并在工具代码里对 `BaseTool` 做 try/import，未安装 FAC 时不影响 Raven 主流程。
4. **权限**: 工具内用 `frappe.session.user` 做权限控制，与 Raven 现有权限一致。

**实现步骤建议**:
1. 新建 `raven/assistant_tools/__init__.py` 及具体工具模块（如 `raven_channels.py`、`raven_messages.py`）。
2. 每个工具类：`name`、`description`、`inputSchema`、`execute(arguments)`，在 `execute` 中调用现有 Raven API 或直接读 DB（需校验当前用户对频道/消息的权限）。
3. 在 `hooks.py` 中条件注册：仅当 `frappe.get_installed_apps()` 含 `frappe_assistant_core` 时导出 `assistant_tools` 列表，避免未安装 FAC 时 import 报错。
4. 可选：在 Raven Settings 增加“向 FAC 暴露 Raven 工具”开关，通过 hooks 中条件判断是否返回工具列表。

---

## 3. 方案对比与推荐

| 维度           | 方案 A（Raven 调 FAC）     | 方案 B（FAC 调 Raven）     |
|----------------|----------------------------|----------------------------|
| 用户体验       | Raven 内与 Bot 对话即可用 ERPNext | 需在 Claude/ChatGPT 等连接 FAC 时使用 |
| 认证           | 需在 Raven 内解决 FAC 的 Bearer（每用户或服务端密钥） | FAC 已有 OAuth，工具内用 session |
| 开发量         | 中等（配置 + HostedMCPTool + 认证） | 中等（若干 BaseTool + hooks） |
| 依赖           | 需安装 FAC                 | 需安装 FAC                 |
| 适用场景       | 内部协作、在 Raven 里查单/报表 | 外部 LLM 统一入口操作 Raven |

**建议**: 若目标主要是“在 Raven 里用 Bot 操作 ERPNext”，优先做 **方案 A**；若目标主要是“让 Claude Desktop 等通过 FAC 操作 Raven”，优先做 **方案 B**。两者可并存（混合方案）。

---

## 4. 技术细节补充

### 4.1 FAC MCP 端点与协议
- 单端点: `POST .../frappe_assistant_core.api.fac_endpoint.handle_mcp`
- 协议: MCP 2025-03-26，JSON-RPC 2.0，Streamable HTTP
- 方法: `initialize`、`tools/list`、`tools/call` 等

### 4.2 OpenAI Agents SDK 的 HostedMCPTool
- 需查阅当前使用的 `agents` 包文档或源码，确认：
  - 是否支持 Streamable HTTP
  - 如何传入 Base URL 与 Authorization header（Bearer 或 api_key:api_secret）
- 若 SDK 仅支持 STDIO，则需在 Raven 侧实现一个“HTTP → MCP 协议”的桥接或换用支持 HTTP 的 MCP 客户端。

### 4.3 Raven 可选依赖 FAC
- 在 `pyproject.toml` 或 `requirements.txt` 中可不写死对 `frappe_assistant_core` 的依赖，改为“可选依赖”或文档说明；运行时用 `frappe.get_installed_apps()` 或 try/except import 判断，避免未安装 FAC 时 Raven 启动失败。

---

## 5. 多智能体设计（FAC 优先作为系统能力来源）

在 FAC 整合基础上，将 Raven 内 AI 能力分层为：**系统级鉴权 Agent**、**业务级 Agents**、**工具类 Agents**，三者协同，且**系统操作能力优先来源于 FAC**。

### 5.1 分层与职责

| 层级 | 名称 | 职责 | 与用户关系 | 能力来源（优先） |
|------|------|------|------------|------------------|
| **系统级** | 鉴权 Agent (Auth Agent) | 静默审查用户操作是否合法；非法时主动抛出拒绝提示 | 不直接与用户对话，仅拦截/放行 | FAC（权限/策略）+ Raven 权限 |
| **业务级** | 业务 Agents (Business Agents) | 按用户角色“站出来”与用户交互；用户仅能选择与自身角色权限相符的智能体 | 显式对话、按角色可见 | FAC 工具 + Raven 工具 + bot_functions |
| **工具级** | 工具 Agents (Tool Agents) | 提供通用能力（查文档、跑报表、执行代码等），可被业务 Agent 或鉴权层间接使用 | 不直接面向用户选择，作为能力子集 | **FAC 为主**（MCP 工具集） |

### 5.2 系统级鉴权 Agent（静默审查）

- **定位**：全局、单例式的“守门员”，不暴露为可选的 Bot，不参与对话生成。
- **触发点**（建议）：
  - 用户发送消息给任意 Bot 之前（如 `handle_bot_dm` 入口处）；
  - Bot 即将执行**工具调用**之前（如 `Runner` 执行 tool call 前的钩子或 wrapper）。
- **输入**：当前用户、目标 Bot/Agent、操作意图（消息文本或即将调用的工具名 + 参数摘要）。
- **输出**：允许 / 拒绝；拒绝时返回**可展示给用户的提示文案**（如“您没有权限通过 Bot 执行该文档的删除操作”）。
- **实现要点**：
  - 可复用 Raven 现有权限（`permissions.py`、`get_channel_member`、`is_admin` 等）做**预检**；
  - 若接入 FAC，可调用 FAC 暴露的“权限/策略检查”类工具（若有）或 FAC 侧 DocType 读权限，做二次校验；
  - 拒绝时：不调用 LLM 生成回复，直接向用户返回固定/配置化提示，并记录审计日志（可选）。

### 5.3 业务级 Agents（按角色站出来）

- **定位**：用户可见、可选的“Bot”或“Agent 角色”，每个 Agent 对应一组允许的操作与可见工具集。
- **与角色绑定**：
  - 在 Raven 中扩展：Raven Bot 或新建“Raven Agent 配置”与 **Frappe 角色**（或 Raven 自定义角色）关联；
  - 用户打开“选择 Bot/Agent”列表时，只展示**当前用户角色有权使用**的 Agent；
  - 若不做“选择列表”，也可由**系统根据用户角色自动派出**对应业务 Agent（例如：仅 HR 角色看到 HR 助手）。
- **能力来源**：
  - **优先**：FAC 的 MCP 工具（通过方案 A 的 HostedMCPTool 注入）；
  - 其次：现有 Raven AI Function + bot_functions（DocType CRUD 等）；
  - 每个业务 Agent 可配置“允许使用的工具子集”（如只允许查 Sales Order、不许删文档），与鉴权 Agent 的规则一致。
- **“站出来”的形态**：在 UI 上可体现为“仅列出与当前用户角色匹配的 Bot”，或在一个统一入口下按角色展示不同 Agent 卡片/描述。

### 5.4 工具类 Agents

- **定位**：不直接作为用户可选的一级对象，而是**能力的集合**，被业务 Agent 或系统逻辑使用。
- **能力优先来源于 FAC**：
  - 通过方案 A 将 FAC 的 MCP 端点挂到 Raven，FAC 提供的 20+ 工具（文档 CRUD、搜索、报表、Python 执行、可视化等）即成为“工具类”能力池；
  - 业务 Agent 在 `_setup_tools()` 中得到的 HostedMCPTool，本质上就是对这些工具类能力的聚合调用；
  - 若需“仅工具、无对话”的调用（如定时报表），可单独实现一个轻量 Runner，只调用 FAC 工具、不暴露给终端用户对话。
- **与鉴权的关系**：工具执行前仍经**鉴权 Agent** 审查（例如：该用户所属角色是否允许调用“执行 Python”类工具），避免越权。

### 5.5 多智能体与 FAC 的衔接

- **鉴权 Agent**：可选调用 FAC 的权限/查询类工具做系统级策略判断；若无，则仅用 Raven + Frappe 权限。
- **业务 Agent**：通过方案 A 为每个业务 Bot 注入 FAC HostedMCPTool，其**系统操作能力（ERPNext/报表/执行等）优先来自 FAC**；Raven 自有的 `create_raven_tools` 等作为补充。
- **工具 Agent**：FAC 的 MCP `tools/list` 即工具 Agent 的能力目录；Raven 不重复实现 FAC 已提供的能力，仅做路由与权限包装。

### 5.6 实现顺序建议

1. **先落地方案 A**（Raven 连 FAC，HostedMCPTool + 认证），使“工具能力来自 FAC”可用。
2. **再实现鉴权 Agent**：在 `handle_bot_dm` 与工具执行前加钩子，调用权限检查（Raven + 可选 FAC），拒绝时返回固定提示。
3. **扩展 Bot/Agent 与角色**：Raven Bot 或新 DocType 增加“允许使用的角色”/“可见工具子集”，前端按角色过滤可选 Agent 列表。
4. **明确“工具类”边界**：在配置或文档中约定哪些能力只通过 FAC 暴露、哪些由 Raven 原生提供，便于后续维护与审计。

---

## 6. 改进意见与风险

### 6.1 需求侧改进建议

- **鉴权粒度**：除“能否用某 Bot / 某工具”外，建议支持**数据级**鉴权（如：只能查本部门的 Sales Order），与 Frappe 的 Permission 和 DocType 权限一致；FAC 若已带用户上下文，可复用。
- **审计与可观测性**：对鉴权拒绝、工具调用（尤其是 FAC 侧的敏感操作）做**结构化日志或审计表**，便于合规与排障。
- **降级策略**：FAC 不可用时（超时、未安装），业务 Agent 应能降级为“仅 Raven 工具”，并提示用户“部分系统能力暂不可用”，避免整条对话失败。
- **角色与 Bot 的配置化**：建议“角色 ↔ Agent”的映射做成配置（如 Raven Settings 表或新 DocType），而不是写死在代码里，方便按站点定制。

### 6.2 架构与实现注意点

- **鉴权 Agent 是否用 LLM**：若仅做规则判断（角色、权限表），可**不用 LLM**，纯逻辑即可，延迟低、成本小；若需“理解自然语言意图再决定是否放行”，再考虑轻量 LLM 调用，并注意延迟与一致性。
- **多 Agent 的会话隔离**：同一用户与不同业务 Agent 的会话应隔离（Raven 已有 thread/channel 维度，可沿用）；鉴权 Agent 无会话，仅请求/响应。
- **FAC 与 Local LLM**：当前 Raven 在 Local LLM 下会过滤掉 HostedMCPTool，即 FAC 能力在 Local LLM 下不可用；若未来要支持“本地模型 + FAC 工具”，需评估 FAC 端点与本地模型的协同方式（例如仅工具走 FAC、推理走本地）。

### 6.3 风险简要

- **依赖 FAC 可用性**：FAC 故障或版本不兼容会直接影响“系统能力优先来自 FAC”的体验，需有降级与监控。
- **权限双源**：Raven 与 FAC 两套权限需对齐，否则可能出现“Raven 放行、FAC 拒绝”或反向不一致，建议以 Raven 为唯一鉴权入口，FAC 仅作能力提供方，或明确约定 FAC 端权限与 Raven 的对应关系。

---

## 7. 后续可做

1. **方案 A**: 在 Raven Settings 加 FAC 配置项 → 实现取 token（或 api_key）逻辑 → 在 `_setup_tools` 中追加 HostedMCPTool → 用 MCP Inspector 或 Raven 内 Bot 对话验证。
2. **方案 B**: 实现 1～2 个 Raven 的 BaseTool（如 list_raven_channels、get_raven_channel_messages）→ 在 hooks 中注册 → 安装 FAC 后在 MCP Inspector 中确认 `tools/list` 出现 Raven 工具并测试 `tools/call`。
3. **多智能体**：实现鉴权钩子（消息入口 + 工具执行前）→ Bot/Agent 与角色配置 → 前端按角色过滤可选 Agent。
4. 在 cos-logs 或 README 中记录“FAC 整合 + 多智能体”的启用条件与配置说明，便于后续维护。
