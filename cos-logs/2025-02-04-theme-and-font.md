## 日期
2025-02-04

## 主题样式调整

### 默认主题
- **文件**: `frontend/src/App.tsx`, `frontend/src/ThemeProvider.tsx`
- **修改**: 默认外观设为「跟随系统」：`useStickyState` 与 `ThemeContext` 默认值均为 `'inherit'`（曾为 `dark`，后改为 `light`，现改为 `inherit`）。
- **原因**: 产品要求默认使用系统主题（随系统明亮/深色自动切换）。

### 全局默认字体
- **文件**: `frontend/src/index.css`
- **修改**:
  - `:root` 增加 `--default-font-family`。
  - `.radix-themes` 设置 `--default-font-family`、`--heading-font-family` 为指定字体栈（含 `!important`）。
  - `body` 设置 `font-family` 为同一字体栈（`!important`）。
  - `.rt-Button` 改为使用 `var(--default-font-family) !important`，不再使用 Cal Sans。
- **字体栈**: "HarmonyOS Sans SC", "HarmonyOSHans-Regular", "HarmonyOSHans-fallback", "PingFangSC-Regular", "Microsoft YaHei", Arial, Helvetica, sans-serif
- **原因**: 统一全局默认字体，优先鸿蒙/苹方/微软雅黑等。

### 侧边栏主题切换按钮
- **文件**: `frontend/src/components/layout/Sidebar/SidebarHeader.tsx`
- **修改**: 在桌面端侧栏头部增加主题切换按钮（复用已有 `ColorModeToggleButton`），与「提及」按钮并排显示；点击在明亮/深色主题间切换。
- **原因**: 方便在侧边栏直接切换主题色，无需进入设置或仅依赖移动端头部。

### 侧边栏底部主题色切换操作菜单
- **文件**: `frontend/src/components/layout/Sidebar/SidebarFooter.tsx`
- **修改**: 在底部「工作区探索」「设置」与用户头像之间增加主题下拉菜单：触发按钮显示当前主题图标（太阳/月亮/显示器），下拉项为「明亮」「深色」「跟随系统」，当前项带勾选；点击即切换并持久化。
- **翻译**: `raven/translations/zh.csv` 新增 Theme→主题、Light→明亮、Dark→深色、System→跟随系统。
- **原因**: 在侧边栏底部提供完整主题切换操作菜单，与设置页外观选项一致。
