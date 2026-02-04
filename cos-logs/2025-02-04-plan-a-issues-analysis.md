# 方案 A 落地过程可能问题分析

**日期**: 2025-02-04  
**关联**: [2025-02-04-fac-integration-plan.md](./2025-02-04-fac-integration-plan.md) 方案 A 任务清单 A1–A8

---

## 1. 问题概览

在按 A1→A8 执行方案 A 时，以下问题可能影响落地，需先沟通并确定解决方式后再做完整实现。

---

## 2. 按任务逐项分析

### A1：查清 HostedMCPTool 签名

**结论（已查清）**：

- Raven 依赖 **openai-agents**（pyproject: `openai-agents>=0.0.16`），导入为 `from agents import HostedMCPTool`。
- `HostedMCPTool` 为 dataclass，仅有两个字段：
  - **`tool_config`**: 类型为 `Mcp`（来自 `openai.types.responses.tool_param`）。
  - **`on_approval_request`**: 可选，MCP 审批回调。
- **`Mcp`（tool_config）** 关键字段：
  - **必填**: `server_label` (str)、`type: "mcp"`。
  - **二选一**: `server_url` (str) 或 `connector_id`（OpenAI 预置 connector）。
  - **认证**: `authorization` (str) —— 文档写明为 “OAuth access token”；也可用 **`headers`** (Dict[str, str]) 传自定义 HTTP 头（如 `Authorization: Bearer xxx`）。
  - 可选: `allowed_tools`、`require_approval`、`server_description`。

**可能问题**：

- 无。签名已明确，可直接用 `HostedMCPTool(tool_config={...})`，FAC 端点填 `server_url`，认证填 `authorization` 或 `headers`。

---

### A2：Raven Settings 增加 FAC 配置项

**可能问题**：

1. **字段放置位置**：Raven Settings 已有 `ai_section`、`enable_ai_integration`、`enable_openai_services` 等；FAC 相关字段应放在 AI 区块内、且与“启用 AI / OpenAI”逻辑不冲突（FAC 为“在启用 OpenAI 的前提下可选”）。
2. **单例与迁移**：Raven Settings 为单例 DocType，新增字段需考虑 **迁移/补丁**：若用 JSON 直接加字段，需 `bench migrate` 或对应 patch，否则旧站点可能缺字段。

**建议**：在 `ai_section` 下、`enable_openai_services` 之后增加 Section Break「FAC Integration」及 `enable_fac_integration`、`fac_mcp_endpoint_url`；若有补丁策略则一并写 patch 设默认值。

---

### A3 / A4：认证字段与认证逻辑（关键风险）

**现状**：

- **FAC 官方**：README 与 Getting Started 明确为 **OAuth 2.0 / OIDC**，用户通过“Connect → 跳转 Frappe 登录 → 授权”获取 token；未提及 API Key 或服务端密钥。
- **OpenAI Mcp**：`authorization` 字段语义为 “OAuth access token”；也可用 `headers` 传 `Authorization: Bearer <token>`。
- **方案文档中的 A2 路径**：假设“若 FAC 支持 api_key:api_secret，则可在 Settings 配 api_key/api_secret”。需核实 FAC 是否真的支持。

**可能问题**：

1. **FAC 是否支持非 OAuth 认证？**  
   若 FAC 仅支持 OAuth，则“服务端 api_key”（A3）不可行，必须走“当前用户 token”（A1 路径）：Raven 后端在请求 FAC 前，用**当前请求用户**完成 OAuth 或 token 交换，把得到的 Bearer 填入 `authorization` 或 `headers`。  
   若 FAC 提供 API Key / 服务端密钥（需查 FAC API_REFERENCE 或源码），则可在 Settings 中配置并走 A2 路径。

2. **“当前用户” token（A1 路径）的实现成本**：  
   - 需要：Frappe OAuth 客户端、Raven 与 FAC 的 redirect/token 端点对接、或复用 FAC 的 OAuth 发现与 token 接口。  
   - Raven 侧需在“用户与 Bot 对话”的请求上下文中拿到当前用户的 access_token（或通过 cookie/session 换 token）。  
   若当前 Raven 尚无“用户级 OAuth token 存储/交换”逻辑，开发量较大。

3. **服务端密钥（A2 路径）的权限语义**：  
   若使用同一 api_key 代表“站点/服务”而非“用户”，则 FAC 侧执行工具时可能是**同一身份**（如某个系统用户），无法做到“按当前聊天用户做 ERPNext 权限”。与文档中“Raven 服务端代表**当前聊天用户**调用 FAC”的目标可能冲突，需产品上明确是否接受“Bot 以统一服务身份访问 FAC”。

**FAC 文档结论（已核实）**：

- FAC MCP Streamable HTTP 文档明确：**Authentication: OAuth 2.0 Bearer tokens**；Token 校验为从 `Authorization: Bearer <token>` 取 token，校验 Frappe 的 `OAuth Bearer Token` 文档并 `frappe.set_user(bearer_token.user)`。**未提供 API Key 或服务端密钥**； legacy STDIO 曾用 “API Key in environment”，当前 Streamable HTTP 已改为仅 OAuth。

**补充（实测）**：

- **Frappe 用户 API Key:Secret 可作为认证头通过 FAC 认证**（已测试）。Frappe 标准：`Authorization: token api_key:api_secret`（见 `frappe.auth.validate_auth_via_api_keys`）；FAC 端点走 Frappe 请求层，会先做认证，因此使用该格式时 FAC 侧同样能通过认证并设置 `frappe.set_user`（对应用户为 User 文档中该 api_key 所属用户）。

**建议（首版采用单用户 OAuth 方式，并支持两种单用户认证）**：

- **A3**：在 Settings 增加两种可选认证方式（二选一或仅填一种即可用）：  
  - **OAuth 单用户**：**`fac_bearer_token`**（Password）：管理员从 MCP Inspector 等完成一次 OAuth 后粘贴 access_token，用于单身份/联调。  
  - **Frappe 用户 API Key**：**`fac_api_key`**（Data）、**`fac_api_secret`**（Password）：使用 Frappe User 的 API Key + API Secret，请求时构造 `Authorization: token api_key:api_secret`。  
- **A4**：  
  - 若配置了 `fac_bearer_token`，则 `authorization: "Bearer " + get_password("fac_bearer_token")` 传入 HostedMCPTool。  
  - 否则若配置了 `fac_api_key` 且能取到 `fac_api_secret`，则 `authorization: "token " + api_key + ":" + api_secret` 传入 HostedMCPTool。  
  - 两者皆未配置则跳过注入 FAC（不报错）。  
- **后续迭代**：每用户 OAuth（Raven 内“连接 FAC”并存储每用户 token）或“按请求转发当前用户的 Bearer”等，可与 Mobile 侧结合（见下文 §5）。

---

### A5：在 _setup_tools 中注入 HostedMCPTool

**可能问题**：

1. **调用时机与 self.settings**：`_setup_tools` 在 `RavenAgentManager.__init__` 中调用，此时已执行 `self.settings = frappe.get_single("Raven Settings")`，可直接读 `enable_fac_integration`、`fac_mcp_endpoint_url` 等；需注意 **缓存**：若用户在对话过程中修改 Settings，可能需下次新建 Manager 才生效（一般可接受）。

2. **仅 OpenAI 路径注入**：方案要求 FAC 仅在 OpenAI（或支持 Hosted MCP 的 provider）下生效；`_filter_tools_for_provider` 已在 Local LLM 下过滤掉 `HostedMCPTool`。因此 A5 只需在 `_setup_tools` 末尾、按条件 append HostedMCPTool，无需在 A5 内再判断 provider（过滤由 A6 保证）。

3. **认证信息注入方式**：  
   - 若 token 为“当前用户”且需每次请求动态获取，则 `_setup_tools` 在 __init__ 时可能还没有 request 上下文（例如后台任务）。需要确认 Raven 调用 Agent 的入口是否始终在 HTTP 请求内、且 `frappe.session.user` 可用；若存在后台/队列场景，需在工具实际被调用时再取 token（若 SDK 支持延迟注入）或在该场景下不启用 FAC。

**建议**：A5 中仅在 `enable_fac_integration` 为真且 `fac_mcp_endpoint_url` 非空时 append；认证逻辑（A4）返回的若为“静态”配置（如 api_key），可直接写入 `tool_config`；若为“按请求 token”，需确认 agents 是否支持运行时注入，否则首版仅支持“请求内同步调用”场景。

---

### A6：保持 Local LLM 过滤逻辑

**可能问题**：无。现有 `_filter_tools_for_provider` 已按 `HostedMCPTool` 等类型过滤，A6 仅需确认不删除、不放宽该逻辑。

---

### A7：可选依赖与运行时判断

**可能问题**：

1. **FAC 应用名**：文档与 FAC 仓库均为 `frappe_assistant_core`，用 `frappe.get_installed_apps()` 判断时需写对该字符串。
2. **未安装时的行为**：若未安装 FAC，不应 import FAC 专属模块；仅根据 Settings 的 `enable_fac_integration` 与 `get_installed_apps()` 决定是否添加 HostedMCPTool，避免 import 报错。若用户误开启 FAC 但未安装 app，可打 log 并跳过注入，不抛错。

**建议**：在注入 FAC HostedMCPTool 前加条件：`"frappe_assistant_core" in frappe.get_installed_apps()`；未安装时跳过并可选 log。

---

### A8：联调与验证

**可能问题**：

1. **环境**：当前 bench 可能未安装 FAC，A8 需在“已安装 FAC 的站点”上做，或文档中说明“联调需先 get-app + install-app frappe_assistant_core”。
2. **认证**：若首版为“占位 token”或“单用户 token”，需在 FAC 侧确认该 token 能通过鉴权（例如 FAC 的 OAuth 校验或 API Key 校验）。
3. **MCP 协议版本**：FAC 文档写 MCP 2025-03-26、Streamable HTTP；OpenAI Responses API 的 MCP 支持需与 FAC 端点兼容，若有兼容性问题需 FAC 或 SDK 侧排查。

**建议**：实现完成后在文档中写明 A8 的验收步骤（含“安装 FAC → 配置 URL 与认证 → Raven 内与 Bot 对话触发 FAC 工具”）；若暂时无 FAC 环境，可先做“无 FAC 时跳过 + 不报错”的验收。

---

## 3. 汇总：需沟通确认的决策（已按单用户 OAuth + api_key:secret 更新）

| 序号 | 决策点 | 选项 | 建议（已更新） |
|------|--------|------|----------------|
| 1 | **FAC 认证方式** | 单用户 OAuth + Frappe 用户 api_key:secret（实测支持） | 首版：Settings 支持两种单用户认证二选一——**fac_bearer_token**（OAuth 粘贴）或 **fac_api_key + fac_api_secret**（User API Key，格式 `token api_key:api_secret`）；多用户 OAuth 后续迭代。 |
| 2 | **首版 token 身份** | 统一单用户（所有 Bot 调用同身份） | 首版用统一单用户（Bearer 或 api_key:secret），FAC 侧为同一用户身份；若需“当前聊天用户”身份，可后续做“按请求转发 Bearer”或每用户 token（见 §5 Mobile 结合）。 |
| 3 | **Raven Settings 字段与补丁** | 仅加 JSON 字段 vs 带 migrate/patch | 建议加字段同时提供简单 patch 或说明“bench migrate”后生效，避免旧站点缺字段。 |
| 4 | **首版范围** | FAC 开关 + URL + 两种单用户认证 | 首版：A2 + A5 + A6 + A7 + A3/A4（fac_bearer_token 或 fac_api_key + fac_api_secret），A8 在有机会时联调；完整每用户 OAuth 作为下一步。 |

---

## 4. 建议的落地顺序（与文档一致）

1. **A1**：已明确，无需再查。  
2. **A2**：在 Raven Settings 增加 FAC Section 与 `enable_fac_integration`、`fac_mcp_endpoint_url`。  
3. **A3**：增加两种单用户认证字段：**fac_bearer_token**（Password，OAuth 粘贴）与 **fac_api_key**（Data）+ **fac_api_secret**（Password，Frappe User API Key）。  
4. **A4**：若配置 fac_bearer_token 则用 `authorization: "Bearer " + token`；否则若配置 fac_api_key + fac_api_secret 则用 `authorization: "token api_key:api_secret"`；两者皆无则跳过注入 FAC。  
5. **A5**：在 `_setup_tools` 中按条件注入 `HostedMCPTool(tool_config=...)`。  
6. **A6**：确认不改动现有 Local LLM 过滤。  
7. **A7**：`get_installed_apps()` 含 `frappe_assistant_core` 才注入，否则跳过。  
8. **A8**：有 FAC 环境时做联调；无则文档验收“未安装/未配置时不影响 Raven”。

确认上述决策后，即可按该顺序做完整实现；若有偏好（例如“首版必须每用户 OAuth”或“仅服务端密钥”），可据此调整 A3/A4 与首版范围。

---

## 5. Mobile 授权逻辑与 FAC 结合分析

### 5.1 Mobile 侧授权逻辑（Raven apps/mobile）

- **发现与端点**：`lib/auth.ts` 使用 Frappe OAuth2 发现：`authorizationEndpoint`、`tokenEndpoint`、`revocationEndpoint`（`frappe.integrations.oauth2.*`）。
- **加站流程**：`AddSite.tsx` 调用 `raven.api.raven_mobile.get_client_id` 获取站点 OAuth client_id → 使用 `expo-auth-session` 的 `useAuthRequest`，`authorizationEndpoint`、`tokenEndpoint`、`exchangeCodeAsync` → 拿到 `TokenResponse` 后 `storeAccessToken(siteName, token)` 存入 **SecureStore**（按站点 key：`${siteName}-access-token`）。
- **请求鉴权**：`FrappeNativeProvider.tsx` 将 `tokenParams: { type: 'Bearer', useToken: true, token: getAccessToken }` 传给 `FrappeProvider`；`getAccessToken` 为异步函数，从 SecureStore 读出当前站点的 token 字符串。即 **所有对站点的 API 请求** 使用 **Authorization: Bearer &lt;OAuth access_token&gt;**。
- **Token 刷新**：`app/[site_id]/_layout.tsx` 中按 `TokenResponse.shouldRefresh()` 或过期阈值，调用 `refreshAsync`（refresh_token）→ `storeAccessToken` 更新，并 `revokeAsync` 旧 token。前台/后台切换、网络恢复时也会触发刷新。
- **小结**：Mobile 为 **按站点、按用户** 的 OAuth 令牌：每站点一份 TokenResponse（access_token + refresh_token），用户切换站点即切换 token；**身份即当前登录该站点的用户**。

### 5.2 Raven 后端与 FAC 的调用关系

- **调用链**：用户（Web 或 Mobile）在 Raven 内与 Bot 对话 → 请求到 Raven 后端（如 `handle_bot_dm`）→ Raven 后端使用 **Raven Settings 中配置的单用户凭证**（fac_bearer_token 或 fac_api_key:fac_api_secret）调用 FAC MCP 端点。
- **Mobile 不直连 FAC**：Mobile 只和 Raven/Frappe API 通信，携带的是 Mobile 的 **Bearer OAuth token**；Raven 后端在调用 FAC 时**不**使用该请求自带的 Authorization，而是使用 Settings 中的单用户凭证。因此当前设计下，**Mobile 用户与 Web 用户** 在 FAC 侧**共享同一身份**（即 Settings 配置的那一个用户）。

### 5.3 结合方式与可选增强（供讨论）

| 方案 | 做法 | 优点 | 注意点 |
|------|------|------|--------|
| **当前首版** | 仅用 Settings 单用户（Bearer 或 api_key:secret）调 FAC | 实现简单、无 Mobile 改动；FAC 能力统一可用 | Mobile 用户在 FAC 侧不是“当前登录用户”，而是配置用户 |
| **按请求转发 Bearer（可选）** | Raven 后端在调用 FAC 时，若请求头带 `Authorization: Bearer &lt;token&gt;`，则优先将该 token 作为 FAC 的 authorization，不再用 Settings 单用户 | Web/Mobile 只要带 OAuth Bearer，FAC 侧即“当前用户”；与 Mobile 现有 OAuth 一致，无需 Mobile 存 FAC 专用 token | 需区分“请求来自已登录用户”且 token 为 OAuth access_token（非 api_key:secret）；FAC 需接受该 Bearer（FAC 已支持 OAuth Bearer） |
| **Mobile 存 FAC 专用 token（可选）** | Mobile 增加“连接 FAC”流程，用户完成一次 FAC OAuth，将 access_token/refresh_token 存 SecureStore，请求 Raven 时可选带 FAC token；Raven 后端按“当前用户 + 其 FAC token”调 FAC | 每用户、每设备可独立授权 FAC，权限清晰 | Mobile 需新增 UI 与 SecureStore 结构，Raven 后端需按用户解析并存储/读取 FAC token，开发量较大 |
| **统一用 User api_key:secret（可选）** | 不为 FAC 单独配 token，而是“当前请求用户”若已绑定 User API Key，则 Raven 后端用该用户的 api_key:api_secret 调 FAC | 无需 OAuth 流程，用户在自己的 User 里生成 API Key 即可 | 需在请求上下文中拿到“当前用户”的 api_key/api_secret（涉及安全与权限策略）；且 Mobile 当前是 OAuth 登录，不是 api_key，需约定“Web 用户绑 API Key 后可在 Raven 用 FAC”等产品逻辑 |

### 5.4 建议讨论点

1. **首版是否只做单用户（Settings）**：采用当前首版（仅 Settings 中 fac_bearer_token 或 fac_api_key:fac_api_secret），不改 Mobile，FAC 侧统一为配置用户；待多用户需求明确后再做“按请求转发 Bearer”或 Mobile 存 FAC token。
2. **“按请求转发 Bearer”的优先级**：若希望 Web/Mobile 与 Bot 对话时 FAC 侧即当前登录用户，可优先在 Raven 后端做：若请求带 `Authorization: Bearer &lt;...&gt;` 且未配置 fac_bearer_token/fac_api_key，则用该 Bearer 调 FAC；否则回退到 Settings 单用户。这样 Mobile 无需改版即可获得“当前用户”语义（因 Mobile 已带 OAuth Bearer）。
3. **Mobile 是否展示/区分“FAC 身份”**：若长期使用单用户配置，是否在 Mobile 设置或对话处提示“Bot 的 FAC 能力以配置的管理员身份运行”等，避免误解为“以我本人身份操作 ERPNext”。
