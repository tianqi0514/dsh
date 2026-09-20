export interface ChuanshenOverviewItem {
  id: string;
  name: string;
  status?: string;
  description?: string;
}

export interface ChuanshenOverview {
  status: 'connected' | 'partial' | 'unavailable';
  checkedAt: string;
  toolCount: number;
  capabilityGroups: readonly { id: string; label: string; description: string; accent: string; toolCount: number }[];
  spaces: readonly ChuanshenOverviewItem[];
  projects: readonly ChuanshenOverviewItem[];
  analysisTasks: readonly ChuanshenOverviewItem[];
  errors: readonly string[];
}

export interface ChuanshenSpaceOverview {
  spaceId: string;
  status: 'connected' | 'partial' | 'unavailable';
  documentCount: number;
  jobCount: number;
  jobCounts: Readonly<Record<string, number>>;
  writingGraph: readonly { id: string; label: string; total: number; verified: number; pending: number }[];
  reasoning: { ready: boolean; blockerCount: number };
  errors: readonly string[];
}

async function request<T>(endpoint: string, payload: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/workdsh-chuanshen', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint, payload }),
    signal,
  });
  const result = await response.json().catch(() => undefined) as { ok?: boolean; value?: T; error?: { message?: string } } | undefined;
  if (!response.ok || !result?.ok || result.value === undefined) throw new Error(result?.error?.message ?? `传神智库请求失败（${response.status}）`);
  return result.value;
}

export interface ChuanshenManagementClient {
  overview(): Promise<ChuanshenOverview>;
  spaceOverview(spaceId: string): Promise<ChuanshenSpaceOverview>;
}

export function createChuanshenManagementClient(signal: AbortSignal): ChuanshenManagementClient {
  return {
    overview: () => request('overview', {}, signal),
    spaceOverview: spaceId => request('space-overview', { spaceId }, signal),
  };
}
