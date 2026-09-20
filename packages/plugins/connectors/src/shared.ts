export type ConnectorState = 'discovering' | 'ready' | 'offline' | 'disabled';

/**
 * MCP calls remain bounded, while the default covers legitimate cold semantic
 * search latency. This is connector-scoped so faster services may keep a
 * shorter deadline without weakening every MCP connection.
 */
export const DEFAULT_CONNECTOR_TOOL_CALL_TIMEOUT_MS = 30_000;
export const MIN_CONNECTOR_TOOL_CALL_TIMEOUT_MS = 1_000;
export const MAX_CONNECTOR_TOOL_CALL_TIMEOUT_MS = 120_000;

export interface ConnectorSummary {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly serverName: string;
  readonly transport: 'stdio' | 'streamable-http';
  readonly scope: 'shared';
  readonly enabled: boolean;
  readonly state: ConnectorState;
  readonly toolNames: readonly string[];
  readonly resourceCount: number;
  readonly resourceTemplateCount: number;
  readonly lastCheckedAt: string;
  readonly toolCallTimeoutMs: number;
  readonly diagnostic?: string;
}

export interface ConnectorConfigView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly serverName: string;
  readonly transport: 'stdio' | 'streamable-http';
  readonly command?: string;
  readonly args?: readonly string[];
  readonly url?: string;
  readonly credentialHeader?: string;
  readonly toolCallTimeoutMs: number;
  readonly authorizationConfigured: boolean;
  readonly authorizationWritable: boolean;
  readonly editable: true;
}

export interface ConnectorInput {
  readonly title: string;
  readonly description?: string;
  readonly serverName: string;
  readonly transport: 'stdio' | 'streamable-http';
  readonly command?: string;
  readonly args?: readonly string[];
  readonly url?: string;
  /** Header that carries the credential; defaults to Authorization (catalog entries may use X-Api-Key). */
  readonly credentialHeader?: string;
  /** Bounded timeout for one MCP tool/resource call. Defaults to 30 seconds. */
  readonly toolCallTimeoutMs?: number;
  /** Transient write-only value. It is stored by ctx.credentials and never returned. */
  readonly authorizationToken?: string;
}

export interface ConnectorManagementService {
  list(signal?: AbortSignal): Promise<readonly ConnectorSummary[]>;
  config(id: string): Promise<ConnectorConfigView>;
  create(input: ConnectorInput): Promise<ConnectorSummary>;
  update(id: string, input: ConnectorInput): Promise<ConnectorSummary>;
  remove(id: string): Promise<void>;
  setEnabled(id: string, enabled: boolean): Promise<ConnectorSummary>;
  selection(sessionId: string): Promise<readonly string[]>;
  setSelection(sessionId: string, connectorIds: readonly string[]): Promise<readonly string[]>;
}
