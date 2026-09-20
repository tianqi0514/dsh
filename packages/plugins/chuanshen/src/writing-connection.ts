import type { ChuanshenClient, JsonValue } from './client.js';

/** Public browser operations. Never accepts a URL, credentials, or arbitrary API path. */
export async function writingOperation(client: ChuanshenClient, endpoint: string, input: Record<string, unknown>, signal: AbortSignal): Promise<JsonValue | undefined> {
  if (!endpoint.startsWith('writing-')) return undefined;
  const id = (key: string) => {
    const value = input[key];
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('chuanshen/invalid-id');
    return encodeURIComponent(value);
  };
  const doc = () => `/writing/documents/${id('document_id')}`;
  const project = () => `/writing/projects/${id('project_id')}`;
  if (endpoint === 'writing-projects') return client.get('/writing/projects?limit=500', signal);
  if (endpoint === 'writing-documents') return client.get(`${project()}/documents`, signal);
  if (endpoint === 'writing-document') return client.get(doc(), signal);
  if (endpoint === 'writing-evidence') return client.get(`${doc()}/paragraph-evidence`, signal);
  if (endpoint === 'writing-facts') return client.get(`${project()}/facts`, signal);
  if (endpoint === 'writing-versions') return client.get(`${doc()}/versions`, signal);
  if (endpoint === 'writing-save') {
    id('base_version_id'); id('request_id');
    if (!Array.isArray(input.content) || input.content.length > 5000) throw new Error('chuanshen/invalid-content');
    return client.post(`${doc()}/versions`, {content: input.content as JsonValue[], base_version_id: String(input.base_version_id), request_id: String(input.request_id), change_summary: 'DSH Plate 编辑保存'}, signal);
  }
  if (endpoint === 'writing-preview') {
    if (typeof input.fact_key !== 'string' || input.fact_key.length > 160 || typeof input.new_value !== 'number' || !Number.isFinite(input.new_value) || typeof input.reason !== 'string' || !input.reason.trim()) throw new Error('chuanshen/invalid-change');
    return client.post(`${project()}/input-changes/preview`, {document_id: decodeURIComponent(id('document_id')), changes: [{fact_key: input.fact_key, new_value: {number: input.new_value}, reason: input.reason}]}, signal);
  }
  // This route is called only by the authenticated browser Connection. There is
  // no model tool which mints approval by passing user_confirmed=true.
  if (endpoint === 'writing-apply') {
    const selected = input.accepted_block_ids;
    if (!Array.isArray(selected) || selected.length === 0 || selected.length > 5000 || selected.some(v => typeof v !== 'string' || !v || v.length > 100) || new Set(selected).size !== selected.length) throw new Error('chuanshen/invalid-selection');
    return client.post(`${project()}/input-changes/apply`, {preview_id: decodeURIComponent(id('preview_id')), accepted_block_ids: selected as string[]}, signal);
  }
  if (endpoint === 'writing-cancel' || endpoint === 'writing-rollback') return client.post(`${project()}/input-changes/${id('preview_id')}/${endpoint === 'writing-cancel' ? 'cancel' : 'rollback'}`, {}, signal);
  if (endpoint === 'writing-validate') return client.post(`${doc()}/validate`, {}, signal);
  if (endpoint === 'writing-exports') return client.get(`${doc()}/exports`, signal);
  if (endpoint === 'writing-export') {
    if (input.output_format !== 'docx' && input.output_format !== 'pdf') throw new Error('chuanshen/invalid-format');
    return client.post(`${doc()}/exports`, {output_format: input.output_format}, signal);
  }
  throw new Error('chuanshen/invalid-operation');
}
