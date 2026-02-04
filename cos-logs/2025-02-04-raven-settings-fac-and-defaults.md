# Raven Settings：FAC 字段与默认值说明

**日期**: 2025-02-04

---

## 1. 新字段在前端不显示时

Raven Settings 新增了 **FAC Integration** 区块及字段（`enable_fac_integration`、`fac_integration_mode`）。DocType 的 JSON 修改后，**必须执行迁移** 才会更新数据库并让表单显示新字段：

```bash
bench migrate
```

迁移后若仍看不到新字段，可再执行：

```bash
bench clear-cache
```

之后刷新 Raven Settings 页面即可。

---

## 2. 默认改为 Local LLM、不默认启用 OpenAI

- **enable_openai_services**：默认由 `1` 改为 `0`（不默认启用 OpenAI）。
- **enable_local_llm**：默认由 `0` 改为 `1`（默认启用 Local LLM）。

上述默认只对 **新站点** 或 **尚未保存过该字段** 的文档生效。**已有站点** 若之前已保存过 Raven Settings，库里仍是旧值；若希望也变成「默认 Local LLM、不默认 OpenAI」，可：

- 在 Raven Settings 页面手动改一次，或  
- 在应用中写 patch，对单例执行 `frappe.db.set_single_value("Raven Settings", "enable_openai_services", 0)` 与 `frappe.db.set_single_value("Raven Settings", "enable_local_llm", 1)`（按需执行一次）。
