# Unreleased — Session selection guards（2026-09-20）

- Add a native monotonic tool guard for selected MCP namespaces and resource discovery/reads. Guard evaluation is dynamic, so late discovery and disabled connectors cannot bypass an earlier visibility mask.
- Child agents without their own selection are denied rather than inheriting another Session's account. This does not claim complete MCP instruction visibility isolation or automatic Team connector delegation.
- Reapply visibility after connector startup, dispose guard registrations with the plugin, and surface unavailable connection errors as actionable messages.
- Resolve each MCP tool against all registered server namespaces before selection checks. Ambiguous nested names and unknown namespaces fail closed; existing definitions are not silently renamed. Resource calls retain exact explicit server matching.
- Replace the hard-coded 10-second MCP call deadline with a per-connector bounded setting (30 seconds by default, 1–120 seconds allowed). Existing records receive the default without exposing credentials; official cancellation remains authoritative and timeout failures remain visible.

# 0.1.0-alpha.1 — 2026-09-15

- 新增真实的本地 stdio MCP 示例，复用 DSH 0.1.6 官方 MCP Client、工具发现、资源读取和生命周期。
- 新增连接器能力页、实际健康检查、配置查看及运行时启停。
