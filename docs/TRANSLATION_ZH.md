# Raven 简体中文本地化方案

本文档说明如何在本地维护 Raven 的简体中文翻译，并尽量减小从官方仓库合并时的冲突。

## 1. 机制概览

- **后端与前端**：Raven 使用 Frappe 的翻译体系。前端通过 `__("...")` 从 `window.frappe.boot.__messages` 取译文，该对象由服务端根据当前用户语言从各应用的 `translations/*.csv` 合并得到。
- **本仓库**：在 `raven/translations/` 下维护 **仅包含有译文的条目** 的 `zh.csv`（Frappe 约定：语言代码 `zh` 对应简体中文）。未出现在 `zh.csv` 中的字符串会回退为英文，不会出现空白。
- **官方仓库**：上游目前未提供 `zh.csv`。我们单独维护该文件，不修改上游的 POT/PO 或其它语言文件，因此合并时通常不会与官方改动冲突。

## 2. 文件与脚本

| 路径 | 说明 |
|------|------|
| `raven/translations/zh.csv` | 简体中文译文（格式：`source,translation,context`，仅含已翻译项） |
| `raven/locale/main.pot` | 由上游/Babel 维护的原文模板，本方案只读、不提交修改 |
| `scripts/build_zh_translations.py` | 根据 POT 与内置英→简中词典生成/更新 `zh.csv` |
| `scripts/sync_translations_from_pot.py` | 从 POT 提取 msgid、与现有 zh 合并或列出未译项 |

## 3. 日常流程

### 3.1 只更新译文（不改 POT）

1. 编辑 `scripts/build_zh_translations.py` 中的 `ZH_MAP`，增加或修改 `"英文原文": "简体中文"`。
2. 在项目根目录执行：
   ```bash
   python3 scripts/build_zh_translations.py
   ```
3. 提交 `raven/translations/zh.csv`（以及若需一并提交的 `scripts/build_zh_translations.py`）。

### 3.2 上游合并后（POT 有更新）

1. 拉取/合并官方最新代码（此时 `raven/locale/main.pot` 可能新增或删除 msgid）。
2. **可选**：查看当前 POT 中有哪些尚未在 zh 中翻译：
   ```bash
   python3 scripts/sync_translations_from_pot.py --list-missing
   ```
3. 在 `build_zh_translations.py` 的 `ZH_MAP` 中为新出现的英文串补充译文，然后：
   ```bash
   python3 scripts/build_zh_translations.py
   ```
4. 若希望 **仅保留“仍在 POT 中且已有译文”的条目**（去掉已从 POT 删除的旧键，且不写入空译文），可再执行：
   ```bash
   python3 scripts/sync_translations_from_pot.py --merge
   ```
   这样 `zh.csv` 只含当前 POT 中仍存在且我们已翻译的条目，避免无效键。

### 3.3 导出空白模板（用于批量翻译）

若需要把“待译原文”导出成 CSV 给翻译人员填写：

```bash
python3 scripts/sync_translations_from_pot.py --export-template -o raven/translations/zh_template.csv
```

翻译完成后，可把结果合并进 `ZH_MAP` 或按 Frappe CSV 格式写回 `zh.csv`（注意保留 `source,translation,context` 三列）。

## 4. 合并策略与冲突

- **只增不改**：我们仅新增/维护 `raven/translations/zh.csv` 及本仓库的脚本，不修改 `raven/locale/main.pot` 或其它应用的翻译文件。
- **冲突场景**：若将来官方也加入 `raven/translations/zh.csv`，合并时可能产生冲突。处理方式：保留我方译文，并把对方新增的键合并进来（缺译的键可不写，继续回退英文）。
- **建议**：每次从官方合并后跑一遍 `build_zh_translations.py`（必要时再跑 `--merge`），保证 zh 与当前 POT 一致且无空译文。

## 5. 占位符与格式

- 文中占位符使用 `{0}`、`{1}` 等，与代码中的 `__("...", [arg0, arg1])` 对应，**不要**在译文中改掉或翻译 `{0}`。
- CSV 中若字段内含逗号、换行，需用双引号包裹；脚本已按标准 CSV 写入。
- 新行在 CSV 内以 `\n` 形式存在，Frappe 读取时会还原为换行。

## 6. 如何让站点使用简体中文

1. 在 Frappe/ERPNext 中启用语言「简体中文」（若未启用，在 Language 列表中添加并启用）。
2. 用户资料或系统设置中将默认语言设为「简体中文」（或 `zh`）。
3. 清除缓存或重新加载页面后，Raven 界面会从 `raven/translations/zh.csv` 加载对应译文。**推荐**：在 bench 目录下执行 `bench --site <站点名> clear-cache`（或 `bench --site all clear-cache`）。若仍不生效，再执行 `bench --site all execute frappe.translate.clear_cache` 显式清除翻译缓存（Raven 已通过 `clear_cache` 钩子自动调用，一般只需 `clear-cache`）。**用户需将界面语言设为「简体中文」**，并做一次**强制刷新**（Ctrl+Shift+R 或 Cmd+Shift+R）以加载最新 boot 与译文。
