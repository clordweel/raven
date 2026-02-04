# FAC 整合到 Raven 的验证步骤

本文说明如何确认 Frappe Assistant Core (FAC) 已成功整合到 Raven（同进程模式）。

---

## 1. 前置条件

- **Raven**：已启用 AI 集成；Raven Settings 中勾选 **Enable FAC Integration**，**FAC Integration Mode** 选 **In-process**。
- **FAC**：已安装应用 `frappe_assistant_core`（`bench get-app` / `install-app`），且 FAC 侧「助手」已对当前站点/用户开放。
- **Bot**：至少有一个 Raven Bot，且 **Model Provider** 为 **OpenAI**（FAC 同进程整合仅在 OpenAI 提供商下注入工具；使用 Local LLM 的 Bot 不会加载 FAC 工具）。

---

## 2. 配置检查

| 检查项 | 位置 | 期望 |
|--------|------|------|
| 启用 AI 集成 | Raven Settings → AI Settings | 勾选 **Enable AI Integration** |
| 启用 FAC 整合 | Raven Settings → AI Settings → FAC Integration | 勾选 **Enable FAC Integration** |
| FAC 模式 | 同上 | **In-process** |
| Bot 提供商 | Raven → Bots → 编辑 Bot | **Model Provider** = **OpenAI** |
| 已安装 FAC | `bench --site <site> list-apps` 或 Desk | 存在 `frappe_assistant_core` |

---

## 3. 日志验证（推荐）

当用户在与 **OpenAI** Bot 的对话中首次触发 AI 请求时，Raven 会创建 `RavenAgentManager` 并执行 `_setup_tools()`。若 FAC 同进程整合成功：

- **成功**：在 `bench` 控制台或日志中会出现类似：
  ```text
  Raven FAC integration: loaded N FAC tools for session user (e.g. ['list_documents', 'create_document', ...])
  ```
- **失败**：若加载 FAC 工具抛错，会写入 **Error Log**（Desk → Error Log），标题为 **FAC In-Process Integration Error**，可据此排查（如 FAC 未安装、`in_process` 模块不存在、权限/配置问题等）。

**操作建议**：打开一个使用 **OpenAI** 的 Bot 所在频道，发送一条会触发 AI 回复的消息（例如「你好，你能做什么？」），然后查看运行 `bench start` 的终端或对应日志文件，确认是否出现上述 “loaded N FAC tools” 的日志。

---

## 4. 功能验证（与 Bot 对话）

1. 进入已添加 **OpenAI Bot** 的频道（且该 Bot 已启用、FAC 整合在 Raven Settings 中已开启）。
2. 发送会触发 FAC 工具使用的请求，例如：
   - 「列出一些 Customer 文档」或「帮我查一下最近 5 条 Sales Order」
   - 「创建一个 Lead」或「在 ERPNext 里查一下 Item 列表」
3. **预期**：Bot 能正常回复，且内容基于 **FAC 工具** 返回的数据（如真实 DocType 列表、创建结果等）。若 Bot 回复中包含来自 ERPNext/Frappe 的数据，说明 `call_fac_tool` 已被模型调用且 FAC 同进程执行成功。

若 Bot 从未调用 FAC 工具（例如只做通用对话），可多试几条明确要求「查文档、列列表、创建记录」的指令；若仍无 FAC 相关结果，再查 Error Log 和上述日志确认是否加载了 FAC 工具。

---

## 5. 小结

| 验证方式 | 做法 | 成功标志 |
|----------|------|----------|
| 日志 | 触发一次 OpenAI Bot 对话，看控制台/日志 | 出现 “Raven FAC integration: loaded N FAC tools” |
| 错误 | 查看 Error Log | 无 **FAC In-Process Integration Error** |
| 功能 | 与 Bot 对话，要求列文档/查数据/创建记录 | Bot 能返回基于 FAC 工具的真实数据或操作结果 |

三者结合即可确认 FAC 已成功整合到 Raven（同进程模式）。
