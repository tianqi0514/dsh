import type { ChuanshenClient, JsonValue } from './client.js';
import { CHUANSHEN_CAPABILITY_GROUPS, CHUANSHEN_TOOL_PRESENTATIONS } from './capabilities.js';

type JsonRecord = { [key: string]: JsonValue };

export interface ChuanshenOverviewItem {
  id: string;
  name: string;
  status?: string;
  description?: string;
}

function record(value: JsonValue | undefined): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value: JsonValue | undefined): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 300);
  if (typeof value === 'number') return String(value);
  return undefined;
}

export function listRows(value: JsonValue, keys: readonly string[]): JsonValue[] {
  if (Array.isArray(value)) return value;
  const root = record(value);
  for (const key of keys) if (Array.isArray(root[key])) return root[key] as JsonValue[];
  return [];
}

export function overviewItems(value: JsonValue, keys: readonly string[]): ChuanshenOverviewItem[] {
  return listRows(value, keys).flatMap((raw, index) => {
    const item = record(raw);
    const id = text(item.id ?? item.space_id ?? item.project_id ?? item.task_id) ?? `row-${index + 1}`;
    const name = text(item.name ?? item.title ?? item.code) ?? id;
    return [{ id, name, ...(text(item.status ?? item.state) ? { status: text(item.status ?? item.state) } : {}), ...(text(item.description ?? item.summary) ? { description: text(item.description ?? item.summary) } : {}) }];
  });
}

function safeError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (message.startsWith('chuanshen/')) return message;
  if (/timeout|abort/i.test(message)) return 'chuanshen/platform-timeout';
  return 'chuanshen/platform-unavailable';
}

async function capture(client: ChuanshenClient, path: string, signal: AbortSignal): Promise<{ value?: JsonValue; error?: string }> {
  try { return { value: await client.get(path, signal) }; }
  catch (cause) { return { error: safeError(cause) }; }
}

export async function buildChuanshenOverview(client: ChuanshenClient, signal: AbortSignal) {
  const [spacesResult, projectsResult, analysesResult] = await Promise.all([
    capture(client, '/spaces?limit=500', signal),
    capture(client, '/writing/projects?limit=500', signal),
    capture(client, '/analysis/tasks', signal),
  ]);
  const spaces = spacesResult.value ? overviewItems(spacesResult.value, ['items', 'spaces', 'data']) : [];
  const projects = projectsResult.value ? overviewItems(projectsResult.value, ['items', 'projects', 'data']) : [];
  const analysisTasks = analysesResult.value ? overviewItems(analysesResult.value, ['items', 'tasks', 'data']) : [];
  const errors = [spacesResult.error, projectsResult.error, analysesResult.error].filter((value): value is string => Boolean(value));
  return {
    status: errors.length === 3 ? 'unavailable' : errors.length ? 'partial' : 'connected',
    checkedAt: new Date().toISOString(),
    toolCount: CHUANSHEN_TOOL_PRESENTATIONS.length,
    capabilityGroups: CHUANSHEN_CAPABILITY_GROUPS.map(group => ({ ...group, toolCount: CHUANSHEN_TOOL_PRESENTATIONS.filter(tool => tool.group === group.id).length })),
    spaces,
    projects,
    analysisTasks,
    errors: [...new Set(errors)],
  };
}

function number(value: JsonValue | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return 0;
}

function graphLayer(root: JsonRecord, id: string, label: string) {
  const counts = record(root.counts ?? root.summary);
  const raw = record(root[id] ?? counts[id]);
  const verified = number(raw.verified ?? raw.confirmed);
  const pending = number(raw.candidate ?? raw.pending ?? raw.unverified);
  const reportedTotal = number(raw.total ?? raw.count ?? root[`${id}_count`] ?? counts[`${id}_count`] ?? counts[id]);
  // Older governance summaries expose only per-state counts. Never render a
  // contradictory zero total when verified or pending items are present.
  const total = Math.max(reportedTotal, verified + pending);
  return {
    id,
    label,
    total,
    verified,
    pending,
  };
}

export async function buildChuanshenSpaceOverview(client: ChuanshenClient, spaceId: string, signal: AbortSignal) {
  const id = encodeURIComponent(spaceId);
  const [documentsResult, jobsResult, graphResult, readinessResult] = await Promise.all([
    capture(client, `/documents?space_id=${id}&limit=100`, signal),
    capture(client, `/jobs?space_id=${id}`, signal),
    capture(client, `/writing-graph/governance/summary?space_id=${id}`, signal),
    capture(client, `/analysis/readiness?space_id=${id}`, signal),
  ]);
  const documents = documentsResult.value ? listRows(documentsResult.value, ['items', 'documents', 'data']) : [];
  const jobs = jobsResult.value ? listRows(jobsResult.value, ['items', 'jobs', 'data']) : [];
  const jobCounts: Record<string, number> = {};
  for (const raw of jobs) {
    const status = text(record(raw).status ?? record(raw).state) ?? 'unknown';
    jobCounts[status] = (jobCounts[status] ?? 0) + 1;
  }
  const graph = record(graphResult.value);
  const readiness = record(readinessResult.value);
  const blockers = listRows(readiness.blockers ?? readiness.issues ?? [], ['items']);
  const errors = [documentsResult.error, jobsResult.error, graphResult.error, readinessResult.error].filter((value): value is string => Boolean(value));
  return {
    spaceId,
    status: errors.length === 4 ? 'unavailable' : errors.length ? 'partial' : 'connected',
    documentCount: documents.length,
    jobCount: jobs.length,
    jobCounts,
    writingGraph: [
      graphLayer(graph, 'evidence', 'Evidence'),
      graphLayer(graph, 'entity', 'Entity'),
      graphLayer(graph, 'claim', 'Claim'),
      graphLayer(graph, 'fact', 'Fact'),
      graphLayer(graph, 'relation', 'Relation'),
    ],
    reasoning: {
      ready: readiness.ready === true || readiness.is_ready === true || readiness.status === 'ready',
      blockerCount: blockers.length || number(readiness.blocker_count),
    },
    errors: [...new Set(errors)],
  };
}
