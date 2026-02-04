# Raven 设置页按角色限制功能与 Manifest 配置

**日期**: 2025-02-04

---

## 1. Raven 按角色需限制的功能模块归纳

### 1.1 现有后端/角色关系（Raven Admin）

- **Raven Admin**：全局管理员角色，在 Doctype 权限与 API 中用于：
  - 创建/管理 **Raven Workspace**（仅 Raven Admin 可创建 workspace）
  - 管理 **Raven User**（Bot 类型仅 Admin 可写）
  - 频道/频道成员写删（channel write/delete 时若为 channel admin 或 Raven Admin 放行）
  - **Raven Settings**、**Raven Custom Emoji**、**Raven Incoming Webhook**、**Raven Document Notification**、**Raven Message Action**、**Raven Bot**、**Raven Bot Instruction Template**、**Raven AI File Source**、**Raven Bot AI Prompt**、**Raven AI Function**、**Raven Document Notification** 等 DocType 的「写」权限均要求 Raven Admin
  - API：如 `notification.py` 的 `frappe.only_for("Raven Admin")`，AI 相关写操作依赖 Raven Settings 等写权限

### 1.2 设置页（Settings）模块与角色对应

| 模块/菜单       | 前端路径示例                    | 建议所需角色   | 说明 |
|----------------|---------------------------------|----------------|------|
| **My Account** | profile, appearance, preferences | 无（所有用户） | 个人资料、外观、偏好 |
| **Workspace**  | workspaces, users, emojis       | Raven Admin    | 工作区列表/详情、用户列表、自定义表情 |
| **Integrations** | hr, document-notifications, document-previews, message-actions, scheduled-messages, webhooks | Raven Admin | 集成与自动化配置 |
| **AI**         | bots, functions, file-sources, instructions, document-processors, commands, ai-settings | Raven Admin | 智能体、函数、文件源、指令、文档处理器、命令、AI 设置 |
| **独立项**     | mobile-app, push-notifications, help | 无（所有用户） | 移动端、推送通知、帮助与支持 |

非 Raven Admin 用户：仅允许使用 **My Account** 及 **独立项**（mobile-app、push-notifications、help）；访问 Workspace / Integrations / AI 下任意路径时在**页面内**提示权限限制。

---

## 2. Manifest 配置方式

- **位置**：`frontend/src/utils/settingsPermissionManifest.ts`
- **内容**：
  - 按「设置根路径第一段」映射到权限键（如 `my_account`、`workspace`、`integrations`、`ai`、`standalone`）
  - 每个权限键对应 `requiredRole: 'Raven Admin' | null`（null 表示不限制）
- **使用**：
  - 设置页布局根据当前 URL 取第一段路径，查 manifest 得到 `requiredRole`，若当前用户不满足则渲染「权限限制」占位页，否则渲染 `<Outlet />`。
  - 侧栏可据此对「需 Raven Admin」的菜单组做视觉区分（如灰色或提示），非必须隐藏。

---

## 3. 实现要点（本次已做）

- 新增 `settingsPermissionManifest.ts`：定义路径段 → 权限键 → `requiredRole`。
- 新增 `SettingsPermissionRestricted.tsx`：无权限时展示的提示页（文案可翻译）。
- 在 `Settings.tsx` 中：根据 `useLocation().pathname` 解析第一段路径，查 manifest 判断是否允许访问；不允许则渲染 `SettingsPermissionRestricted`，否则渲染 `<Outlet />`。
- 侧栏保持现有结构，非 Admin 点击 Workspace/Integrations/AI 等仍可进入对应路由，但在主内容区看到权限限制提示。
- 翻译：在 `raven/translations/zh.csv` 中增加「权限限制」相关文案；前端使用 `__()`。

---

## 4. 后续可扩展

- 将 manifest 扩展为「模块 + 操作」粒度（如某模块仅允许「读」）。
- 后端 API 已按 DocType/role 做权限控制，前端 manifest 仅控制设置页入口与展示，与后端保持一致即可。
