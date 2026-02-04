# FAC 改造「来自 Raven 的请求免认证」可行性评估

**日期**: 2025-02-04  
**背景**: Web 端 Raven 使用 Cookie 认证，移动端使用 Bearer Token；Raven 后端与 FAC 通信，两者均为 Frappe 自定义应用，理论上可共用一套认证逻辑。评估在 FAC 中改造、使来自 Raven 的请求免去单独认证的可行性。  
**FAC 路径**: `/home/frappe/frappe-bench/apps/frappe_assistant_core/`

---

## 1. 现状与目标

### 1.1 认证现状

| 端 | Raven 认证方式 | 请求到达 Raven 后端时 |
|----|----------------|------------------------|
| Web | Cookie（sid） | `frappe.session.user` 已由 Frappe 从 Cookie 恢复 |
| Mobile | Bearer Token（OAuth access_token） | 请求带 `Authorization: Bearer <token>`，Frappe 的 `validate_auth()` 会校验并 `frappe.set_user()` |

### 1.2 目标

- **免去认证**：Raven 调用 FAC 时不再单独配置/传递 FAC 凭证（如 fac_bearer_token、fac_api_key:api_secret），而是**复用当前请求已有的 Frappe 身份**。
- **共用一套认证**：FAC 信任「同一请求上下文中已由 Frappe 建立的 session / user」，对来自 Raven 的交流请求不再强制要求 Authorization 头。

### 1.3 关键点

- Raven 与 FAC 同站点、同进程：请求先到 Frappe，再路由到 Raven 或 FAC。
- Raven 调用 FAC 的方式有两种可能：
  1. **HTTP 调用**：Raven 后端（或 OpenAI Agents SDK 的 HostedMCPTool）向 `POST .../fac_endpoint.handle_mcp` 发 HTTP 请求。
  2. **同进程调用**：Raven 后端直接调用 FAC 的 MCP 逻辑（同一 Python 进程、同一请求上下文），不经过 HTTP。

---

## 2. FAC 当前认证逻辑（已读码）

- **入口**: `frappe_assistant_core/api/fac_endpoint.py` 的 `handle_mcp()`，使用 `@mcp.register(allow_guest=True, xss_safe=True, methods=["GET", "POST", "HEAD"])`。
- **认证**: 在 `handle_mcp()` 内调用 `_authenticate_mcp_request()`，**仅**根据请求头处理：
  1. `Authorization: Bearer <token>` → 校验 OAuth Bearer Token，`frappe.set_user(bearer_token.user)`。
  2. `Authorization: token <api_key>:<api_secret>` → 校验 User 的 api_key/api_secret，`frappe.set_user(user)`。
  3. 否则 → 返回 401，要求认证。
- **未处理**：请求无 Authorization、但**已有 Frappe session**（例如由 Cookie 或上游已校验 Bearer 并设置好的 session）的情况。

因此，若请求在进入 `handle_mcp` 之前，**已经通过 Frappe 的 Cookie 或 Bearer 建立了 `frappe.session.user`**，FAC 目前仍会因「无 Authorization 头」而返回 401。

---

## 3. Frappe 请求与 Session 的关系（已核实）

- **API 请求**（`/api/...`）：`app.py` 中 `init_request()` 在 `request.method != "OPTIONS"` 时会执行 `frappe.local.http_request = HTTPRequest()`；**HTTPRequest()** 会调用 `set_session()` → **LoginManager()**，LoginManager 会尝试 **resume session**（`make_session(resume=True)`），即从 **Cookie/sid** 恢复 session（`frappe/auth.py`）。随后才执行 `validate_auth()`。
- **validate_auth()**（`frappe/auth.py`）：仅当请求头 **Authorization** 为两段（如 `Bearer xxx` 或 `token api_key:api_secret`）时才校验并设置用户；不负责从 Cookie 恢复，但 **Cookie 恢复已在 HTTPRequest → LoginManager 中完成**。
- **结论**：对 **带 Cookie、无 Authorization** 的 `/api/method/...` 请求，Frappe 会先通过 HTTPRequest → LoginManager 从 Cookie 恢复 session，**在进入具体 API 方法（如 handle_mcp）之前**，`frappe.session.user` 已可能被设置。因此：
  - **Web（仅 Cookie）**：若 Raven 对 FAC 的 HTTP 请求**转发当前请求的 Cookie**，FAC 收到的请求会先经 Frappe 的 HTTPRequest → LoginManager 从 Cookie 恢复 session，再进入 `handle_mcp`；此时 `frappe.session.user` 已非 Guest，FAC 只需信任已有 session 即可免认证。
  - **Mobile（Bearer）**：Raven 若转发 `Authorization: Bearer <token>`，FAC 现有逻辑会校验并设置用户；若 FAC 先做「信任已有 session」，也会直接通过（或由 validate_auth 先设置用户后再进入 handle_mcp，session 已有）。

结论：**场景 A（HTTP + 转发 Cookie/Authorization）与场景 B（同进程调用）均可通过「FAC 信任已有 session」实现免认证。**

---

## 4. 改造方案与可行性

### 4.1 方案一：FAC 信任「已有 Frappe Session」（推荐，改 FAC 即可）

**做法**：在 `_authenticate_mcp_request()` 的**最前面**增加分支：

- 若 `frappe.session.user` 存在且不为 `"Guest"`，则视为已认证，直接 `return frappe.session.user`，不再检查 Authorization。

**效果**：

- **同进程调用（场景 B）**：Raven 直接调 FAC 的 MCP 逻辑时，当前请求已由 Cookie 或 Bearer 建立好 session，FAC 直接信任即可，**真正免认证**。
- **HTTP 调用且转发 Cookie（场景 A 之 Web）**：若 Raven 对 FAC 的 HTTP 请求里带上当前请求的 **Cookie**，且 Frappe 在处理该 FAC 请求时**先**根据 Cookie 恢复 session（再执行到 `handle_mcp`），则 FAC 内也会看到已设置的 `frappe.session.user`，同样可免认证。这依赖 Frappe 对「带 Cookie 的 /api/method/... 请求」是否在进入 API handler 前恢复 session；若会恢复，则本方案可行。
- **HTTP 调用且仅转发 Bearer（场景 A 之 Mobile）**：请求带 `Authorization: Bearer ...`，Frappe 的 `validate_auth()` 会先设置用户，FAC 再信任 session，与现有行为一致；若 FAC 仍先走「信任已有 session」分支，也会直接通过。

**风险与注意**：

- 任何「能访问到 FAC 端点且已带有效 Cookie / 已登录 session」的请求都会被接受（例如同站点的其他前端或脚本）。若 FAC 端点仅限同站点、且仅被 Raven 或可信服务调用，通常可接受；若需更严，可再加「仅允许来自 Raven」的校验（例如自定义头 `X-From-Raven` + 服务端配置）。
- 建议在 FAC 内加日志（如 info），记录「通过已有 session 通过认证」的请求，便于审计。

**结论**：**可行**，改动小（FAC 单文件数行），且与「Web Cookie + Mobile Bearer」共用一套 Frappe 认证逻辑一致。

---

### 4.2 方案二：Raven 转发 Cookie/Authorization，FAC 仍信任已有 Session（与 4.1 配合）

**做法**：

- Raven 调用 FAC 时（无论是通过 HostedMCPTool 还是自写 HTTP 客户端）：
  - **Web**：将当前请求的 **Cookie** 写入对 FAC 的请求头（如 `Cookie: ...`）。
  - **Mobile**：将当前请求的 **Authorization** 写入对 FAC 的请求头（如 `Authorization: Bearer ...`）。

这样，FAC 收到的 HTTP 请求与「用户直接访问 FAC」在认证上等价：先由 Frappe 根据 Cookie 或 Bearer 设置 `frappe.session.user`，再在 FAC 内走「信任已有 session」逻辑。

**前提**：

- 使用 HostedMCPTool 时，需在**每次请求**注入当前用户的 Cookie 或 Authorization；若 SDK 的 `tool_config` 只支持静态字符串，则需在创建 Agent/Manager 时从当前请求取到 Cookie/Authorization 并写入 `headers` 或 `authorization`（若 SDK 支持从当前请求动态取头，则可实现「按请求转发」）。
- Frappe 对「带 Cookie 的 /api/method/fac_endpoint.handle_mcp」请求，必须在进入 `handle_mcp` 前完成 session 恢复，FAC 的「信任已有 session」才有效。若 Frappe 对 API 路径默认不恢复 Cookie session，则需确认或小幅调整 Frappe 的 API 认证顺序（或仅对 FAC 端点做例外）。建议在目标版本上做一次「带 Cookie 的 POST handle_mcp」实测。

**结论**：**可行**，依赖 Raven 侧如何传头 + Frappe 对 API 与 Cookie 的处理；与 4.1 组合可实现「来自 Raven 的请求免去单独 FAC 凭证」。

---

### 4.3 方案三：Raven 与 FAC 同进程调用（无 HTTP，彻底免认证）

**做法**：

- Raven 不通过 HTTP 调 FAC，而是在同一请求内**直接调用 FAC 的 MCP 能力**（例如 FAC 暴露 `list_tools()`、`call_tool(name, arguments)` 等），在同一进程、同一 `frappe.session` 下执行。
- FAC 提供「仅限同进程使用」的入口，该入口**不**执行 `_authenticate_mcp_request()`，直接使用 `frappe.session.user`。

**效果**：

- 无需任何 Cookie/Authorization 转发，也无需 FAC 校验请求头；Raven 与 FAC 完全共用当前请求的认证结果。
- 需要 FAC 抽出可被 Raven 调用的内部接口，以及 Raven 用「FAC 客户端适配器」替代对 FAC 的 HTTP 调用（例如替代 HostedMCPTool 的 HTTP 路径）。

**结论**：**可行**，但改动较大（FAC 暴露内部 API，Raven 集成方式从 HTTP 改为进程内调用）；适合作为后续优化，而不是首版「最小改 FAC 免认证」的方案。

---

#### 4.3.1 方案三展开：结合 FAC 代码现状的说明

以下结合当前 FAC 代码结构，说明方案三的可行路径、FAC 已有能力与需补暴露的接口，以及 Raven 侧的适配方式。

**一、FAC 当前与「同进程调用」相关的结构**

1. **HTTP 入口与 MCP 处理**（`fac_endpoint.py` + `mcp/server.py`）
   - `handle_mcp()`：先 `_authenticate_mcp_request()`，再 `_check_assistant_enabled(authenticated_user)`，再 `_import_tools()`，最后 `return None` 交给装饰器执行 `mcp.handle(request, response)`。
   - `_import_tools()`：清空 `mcp._tool_registry`，从 **ToolRegistry** 取 `get_available_tools(user=frappe.session.user)`，对每个工具用 **tool_adapter.register_base_tool(mcp, tool_instance)** 往 MCPServer 里注册（name、description、inputSchema、fn），其中 `fn` 内部调 `tool_instance._safe_execute(arguments)`。
   - **MCPServer.handle(request, response)**：解析 JSON-RPC，按 `method` 分发：
     - `tools/list` → `_handle_tools_list(params)`：遍历 `self._tool_registry`，返回 `{"tools": [{"name", "description", "inputSchema"}, ...]}`。
     - `tools/call` → `_handle_tools_call(params)`：从 `params` 取 `name`、`arguments`，在 `_tool_registry` 里取 `tool["fn"]`，执行 `fn(**arguments)`，结果用 `json.dumps(..., default=str)` 转成文本，返回 `{"content": [{"type": "text", "text": result_text}], "isError": False/True}`。

2. **ToolRegistry（`core/tool_registry.py`）——与 HTTP/MCP 解耦**
   - **get_available_tools(user)**：按插件启用、FAC Tool Configuration 启用、角色、Frappe 权限过滤，返回当前用户可用的工具元数据列表（MCP 风格：name、description、inputSchema 等）。
   - **get_tool(tool_name)**：按名称返回 BaseTool 实例。
   - **execute_tool(tool_name, arguments)**：校验 `_is_tool_accessible(tool_name, user)` 与 `_check_tool_permission`，再调 `tool._safe_execute(arguments)`，并处理返回的 success/error 结构。这里用的 `user` 即 **frappe.session.user**。

因此：**工具发现与执行的核心逻辑已在 ToolRegistry 中实现，且依赖的是 `frappe.session.user`，与是否经过 HTTP、是否经过 MCPServer 无关。** 同进程下只要 `frappe.session.user` 已由当前请求建立（Cookie 或 Bearer），直接使用 ToolRegistry 即可「免认证」复用 FAC 能力。

**二、方案三的两种实现路径**

**路径 A：Raven 直接使用 FAC 的 ToolRegistry（推荐，FAC 仅做薄封装）**

- **FAC 侧**：在 FAC 内增加一个「同进程专用」模块（例如 `frappe_assistant_core.api.in_process` 或直接在 `fac_endpoint` 中提供函数），暴露两个函数：
  - **list_tools()**：内部 `get_tool_registry()` → `registry.get_available_tools(user=frappe.session.user)`，将返回的元数据整理成与 MCP `tools/list` 一致的格式 `{"tools": [{"name", "description", "inputSchema"}, ...]}`，供 Raven 使用。
  - **call_tool(name, arguments)**：内部 `get_tool_registry()` → `registry.execute_tool(name, arguments)`，返回执行结果（可为 dict/str，由 Raven 按需序列化）；若需与 MCP 一致，可封装为 `{"content": [{"type": "text", "text": ...}], "isError": False}`。
- **前置校验**：在上述两个函数开头做 `_check_assistant_enabled(frappe.session.user)`，未启用则抛错；**不**调用 `_authenticate_mcp_request()`，完全信任当前 session。
- **Raven 侧**：当检测到 FAC 同站点安装且选择「同进程模式」时，不创建 HostedMCPTool，而是创建一个**自定义 Tool**（或实现 SDK 所需的工具接口），该工具在「被 LLM 选中并传入 name + arguments」时，通过 `frappe.call("frappe_assistant_core.api.in_process.call_tool", name=..., arguments=...)` 或直接 `import` FAC 模块后调上述 `call_tool`；工具列表则通过 `list_tools()` 在构建 Agent 时注入到 SDK（或通过一个包装层把 FAC 工具列表转成 SDK 的 tools 参数）。这样 LLM 侧仍按「工具列表 + 工具调用」使用，但执行全部在同进程内完成，无 HTTP、无 FAC 认证头。

**路径 B：Raven 复用 FAC 的 MCPServer 实例（依赖 FAC 内部实现）**

- **FAC 侧**：不新增 API，仅约定「同进程调用方」可调用现有模块级对象 `fac_endpoint.mcp` 的「内部」方法：先由调用方保证 `frappe.session.user` 已设置且 `_check_assistant_enabled` 通过，再调用 `_import_tools()` 填充 `mcp._tool_registry`，然后：
  - 列表：`mcp._handle_tools_list({})`；
  - 执行：`mcp._handle_tools_call({"name": name, "arguments": arguments})`。
- **Raven 侧**：在 Raven 进程内 import `frappe_assistant_core.api.fac_endpoint`，按上述顺序调用；需依赖 FAC 的 `_tool_registry` 生命周期与 `_import_tools()` 的副作用，且与 FAC 版本耦合较强，FAC 升级若调整 MCPServer 或 `_import_tools` 易导致 Raven 侧报错。

**三、推荐与小结**

- **更稳妥、可维护**的是**路径 A**：FAC 只增加一层薄薄的「同进程 API」（list_tools / call_tool），内部完全委托现有 **ToolRegistry**，不暴露 MCPServer 内部；Raven 仅依赖该稳定接口，不依赖 `_handle_tools_list` / `_handle_tools_call` 等内部方法。
- **方案三的本质**：在同进程、同一 `frappe.session` 下，用 **ToolRegistry.get_available_tools + execute_tool** 替代「HTTP + MCP tools/list 与 tools/call」；认证与权限已由 Frappe 的 session 与 ToolRegistry 的 `_is_tool_accessible` / `_check_tool_permission` 覆盖，无需再走 FAC 的 HTTP 认证。
- **改动量**：FAC 增加一个约数十行的同进程模块（list_tools + call_tool + assistant_enabled 校验）；Raven 增加「FAC 同进程适配器」：在 _setup_tools 或等价处，当 FAC 可用且选择同进程时，注入基于上述 list_tools/call_tool 的自定义工具或工具集，替代 HostedMCPTool。整体属于中等改动，适合在方案一验证通过后作为「同站点、零 HTTP」的优化方案落地。

---

## 5. 推荐实施顺序

1. **先做方案一（FAC 信任已有 session）**  
   - 在 `_authenticate_mcp_request()` 开头增加：若 `frappe.session.user` 且不为 Guest，则 `return frappe.session.user`。  
   - 部署后，对「同进程调用」或「已带 Cookie/Authorization 的 HTTP 调用」即可免去 FAC 侧再校验。

2. **再确认 Raven 调用方式**  
   - 若 Raven 通过 **HTTP** 调 FAC：在 Raven 侧实现对 FAC 请求的 **Cookie（Web）或 Authorization（Mobile）转发**，并与方案一配合验证。  
   - 若 Raven 改为**同进程调用** FAC（方案三），则方案一已足够，无需转发头。

3. **可选**：在 FAC 中增加「仅允许来自 Raven」的校验（如自定义头 + 配置），缩小「信任已有 session」的适用范围。

---

## 6. FAC 具体改动建议（方案一）

**文件**: `frappe_assistant_core/api/fac_endpoint.py`

**位置**: `_authenticate_mcp_request()` 函数开头（在读取 `auth_header` 之前或之后均可，建议在最先）。

**新增逻辑**（伪代码）：

```python
def _authenticate_mcp_request():
    # Trust existing Frappe session (e.g. from same-site app like Raven using cookie or forwarded Bearer)
    if frappe.session.user and frappe.session.user != "Guest":
        frappe.logger().info(
            f"MCP request authenticated via existing session for user: {frappe.session.user}"
        )
        return frappe.session.user

    auth_header = frappe.request.headers.get("Authorization", "")
    # ... 保留现有 Bearer / token api_key:api_secret 逻辑 ...
```

**说明**：

- 不改变现有 Bearer / api_key:api_secret 逻辑，仅增加「已有 session 则直接通过」。
- 与「Web 用 Cookie、Mobile 用 Bearer」一致：只要当前请求在 Frappe 侧已建立用户，FAC 就复用该身份，实现共用一套认证逻辑。

---

## 7. 小结

| 问题 | 结论 |
|------|------|
| 能否改造 FAC 使「来自 Raven 的请求免去认证」？ | **可以**。在 FAC 中信任「已有 Frappe session」即可（方案一）。 |
| 与「Web Cookie + Mobile Bearer」是否一致？ | **一致**。FAC 不再强制自己的 Authorization，而是复用 Frappe 已建立的用户（Cookie 或 Bearer 均由 Frappe 先处理）。 |
| 改造量 | **小**：FAC 单处增加数行；Raven 侧若需 HTTP 调用则需转发 Cookie/Authorization（视当前是否已转发而定）。 |
| 风险 | 任何能携带有效 session 访问 FAC 端点的请求都会被接受；可通过「仅允许来自 Raven」等可选校验收紧。 |

建议先落地**方案一**，再根据 Raven 实际调用方式（HTTP 是否转发 Cookie/Authorization，或是否改为同进程调用）做对应适配与联调。

---

## 8. FAC 改造（方案一）——暂未实施

**说明**: 方案一的具体改动已评估并写于上文 §6；原计划在 `frappe_assistant_core/api/fac_endpoint.py` 的 `_authenticate_mcp_request()` 开头增加「信任已有 Frappe session」分支。因需先对 FAC 应用做 git 新配置，**该改动已撤销，待完成配置后再实施**。

**实施时**：在 `_authenticate_mcp_request()` 开头（`auth_header = ...` 之前）增加：

```python
# Trust existing Frappe session (e.g. Raven backend calling FAC with forwarded cookie/Bearer)
if frappe.session.user and frappe.session.user != "Guest":
    frappe.logger().info(
        f"MCP request authenticated via existing session for user: {frappe.session.user}"
    )
    return frappe.session.user
```

**Raven 侧后续**: 若通过 HTTP 调用 FAC，需在请求中**转发当前请求的 Cookie（Web）或 Authorization（Mobile）**，则无需在 Raven Settings 中配置 fac_bearer_token / fac_api_key:api_secret 即可实现「当前用户」身份调 FAC。
