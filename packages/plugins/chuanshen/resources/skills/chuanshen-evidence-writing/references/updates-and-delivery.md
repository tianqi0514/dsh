# 局部修订、影响预览与交付

## 修改前先分类

表达修改只调整措辞，默认保留事实、数值、引用和含义。内容修改可能需要重新检索。共同依据修改才触发 Fact、计算和已登记正文依赖的联动。不要把来源 Chunk、正文块、Fact 和计算结果混成同一对象。

普通文字建议可用 `chuanshen_writing_changeset_create`、`chuanshen_writing_changeset_classify` 查看 ADD/DEL/MOD/MOVE 与绑定诊断；用户明确选择后才应用普通文字变更，不能借 `chuanshen_writing_changeset_apply` 修改受控数字或绕过事实预览。人工新段落没有绑定就标为未绑定，不默认为有证据。

## 权威值变化

用 `chuanshen_writing_change_preview` 提交项目、文稿、真实 `fact_key`、候选值和原因。预览前正文不变；传播由后端依赖计算，不由模型想象，不以字符串全局替换实现。

展示直接和间接影响、原值/候选值、计算路径、受影响章节/表格/摘要、疑似影响、人工覆盖和其他文章。确定影响仅覆盖已登记依赖；语义相似但未绑定的文字只提醒人工检查。不要承诺“任何内容都能自动更新”。

随后使用 `chuanshen_writing_open` 打开 Plate，让用户在影响面板选择全部或部分、取消或应用。Agent 不能调用 `chuanshen_writing_change_apply` 代替该点击；该工具会拒绝代理确认。用户在对话中说“同意”也不能让模型自行签发 UI 回执，不经 shell、HTTP 或其他工具绕过。同样不能用其他事实 override 或编辑工具绕开影响流程。

应用后回读当前文稿与 `chuanshen_writing_version_compare`：所选位置更新，未选位置保留原值/原绑定并标 stale，历史版本不改，无关内容不变。预览过期先重新生成；不要把上次所选项套到新预览。撤销同样由用户在 Plate 点击“撤销上次联动”，Agent 不能通过 `chuanshen_writing_change_rollback` 自行确认；遇到后续变更冲突须停下说明。stale 尚未处理的草稿不能宣称已经一致或可以定稿。

## 审校与交付

`chuanshen_writing_validate` 检查工具可验证的问题；主笔再检查本次任务、必要附件、跨章口径、证据支持、空泛重复和待补项。章节成功不等于整篇完成，整篇检查未写章节应如实列出。

用户要求 Word/PDF 时调用 `chuanshen_writing_export`，并用 `chuanshen_writing_export_status` 等待真实终态。返回真实受权下载/成果入口，不能凭 task_id 宣称文件已生成；失败读业务错误后有限重试。导出绑定到具体文章版本，不能把旧文件当新版本。

Plate 是独立正文编辑器；Office 是 DSH 已有文件插件，两者不互相冒充。通过 Office 打开导出 Word 并不表示其中编辑已反写 Plate 的 Fact 绑定。未实际打开或渲染导出文件时明确说明未验证版式，不把链接存在等同于文件质量通过。
