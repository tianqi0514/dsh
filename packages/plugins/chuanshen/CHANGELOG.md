# Changelog

## 0.1.0-alpha.3

- 对旧版治理汇总接口兼容：缺少 `total` 时由已确认与待确认数量计算可见总数，避免出现“总数 0、已确认非 0”的矛盾展示。
- 通过官方 Skill registry 和 FileSystemSkillProvider 注册 `chuanshen-material-extraction`、`chuanshen-evidence-writing`；Markdown 及按需 references 随包交付，不再把完整写作方法重复写进全局系统提示词。
- 写作方法采用 DSH 主笔读取章节工作包、亲自组织正文、提交 Plate 块与精确数值位置绑定的路径；旧内层 Agent 生成工具不再是该方法的执行路径。
- 材料角色、五层来源核验、借形不借值、量纲和缺值检查、Semantica 证明与人工审读明确分工；来源 ID 存在不再被表述为语义已充分支持。
- 事实更新方法只生成预览并打开 Plate，由用户选择并应用；模型不能以布尔参数自行确认。

## 0.1.0-alpha.2

- Add a DSH-native 「传神智库」 workbench with live spaces, writing projects, Semantica readiness and five-layer writing-graph summaries; no iframe or second business database is introduced.
- Register friendly Chinese execution cards for all 46 wire tools while keeping raw arguments/results behind an expandable diagnostic disclosure.
- Add three native Conversation entry points for ingestion, controlled report generation and fact-change impact preview.
- Upgrade the plugin client/Host composition to the pinned DSH `0.1.6-alpha.2` APIs and add overview aggregation tests.

## 0.1.0-alpha.1

- Add typed NexusOne tools for Chuanshen spaces, document ingestion, four-channel processing, search, writing-graph governance, Semantica analysis, deterministic calculation, report generation, fact-change preview/apply, validation and export.
- Expand the controlled-writing surface to 46 tools with corpus artifacts, value-free skeleton inheritance, project/fact governance, editor semantic diff, chunk evidence, fact-change rollback, immutable version comparison and export status.
- Render inheritance and impact previews as bounded Markdown summaries while preserving structured JSON for tool consumers.
- Keep platform credentials in a repository-external credential file and restrict file ingestion to one configured directory.
