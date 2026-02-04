# 2025-02-04 硬编码策略与翻译更新

## 策略

- 在项目根目录新增 **cos-logs** 目录，用于记录硬编码修改。
- 允许对项目内容进行硬编码整改，加速原型开发，不再严格遵守从源仓库同步的限制。

## 翻译相关修改

### 1. DocumentLinkButton 工具提示

- **文件**: `frontend/src/components/feature/chat/ChatInput/DocumentLinkButton.tsx`
- **修改**: `<Tooltip content={\`Attach a document from the system\`}>` → `<Tooltip content={__('Attach a document from the system')}>`
- **原因**: 工具提示未走翻译函数，中文环境下仍显示英文 "Attach a document from the system"；zh.csv 中已有条目「从系统附加文档」。

### 2. 文档卡片中的 "Price List" / "Price List Name" / "Currency"

- **说明**: 这些标签来自 Frappe 文档预览接口返回的字段名（Doctype 的 field label），在 `DoctypeLinkRenderer` 中直接渲染 `data` 的 key。若需中文显示，需由后端按用户语言返回已翻译的 label，或前端对接 Frappe 的翻译接口，本次未改。
- **“Administrator joined.” 硬编码解决**：后端写入 DB 的为英文（如 "Administrator joined."），前端显示时未命中翻译 key。改为在前端对系统消息做模式匹配，用翻译模板再渲染：
  - **新增**: `frontend/src/utils/systemMessageDisplay.ts`，提供 `getDisplaySystemMessageText(text)`，匹配 `X joined.` / `X added Y.` / `X is now an admin.` / `X is no longer an admin.`，用 `__("{0} joined.", [name])` 等输出译文。
  - **修改**: `frontend/src/components/feature/chat/ChatMessage/SystemMessageBlock.tsx`，系统消息展示改为 `getDisplaySystemMessageText(message.text)`，不再直接 `__(message.text)`。历史英文消息在中文环境下会显示为「Administrator 已加入。」等。
