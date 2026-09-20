const resourceTools = new Set(['list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource']);

/** Only an unambiguous registered namespace establishes a tool's owner. */
export function connectorToolOwner(name: string, registeredServers: readonly string[]): string | undefined {
  const owners = [...new Set(registeredServers)].filter(server => {
    const prefix = `mcp__${server}__`;
    return name.startsWith(prefix) && name.length > prefix.length;
  });
  return owners.length === 1 ? owners[0] : undefined;
}

/** Evaluate again at dispatch, including tools discovered after the Session was created. */
export function connectorCallDenied(name: string, args: unknown, allowedServers: readonly string[], registeredServers: readonly string[]): string | undefined {
  if (resourceTools.has(name)) {
    const server = args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, unknown>).server : undefined;
    if (typeof server !== 'string' || !registeredServers.includes(server) || !allowedServers.includes(server)) return '当前任务未选择该 MCP 连接，不能读取其资源。';
  } else if (name.startsWith('mcp__')) {
    const owner = connectorToolOwner(name, registeredServers);
    if (!owner) return 'MCP 工具未匹配唯一的已登记连接；请检查连接名称是否相互嵌套。';
    if (!allowedServers.includes(owner)) return '当前任务未选择该 MCP 连接，或连接已停用。';
  }
  return undefined;
}
