import { readFile, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve } from 'node:path';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ChuanshenClientOptions {
  apiBaseUrl: string;
  credentialFile: string;
  allowedUploadRoot: string;
  timeoutMs: number;
}

interface CredentialFile {
  username: string;
  password: string;
}

function normalizedBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('chuanshen/config-invalid-api-url');
  return parsed.toString().replace(/\/$/, '');
}

function errorMessage(body: JsonValue, status: number): string {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const detail = body.detail;
    const message = body.message;
    if (typeof detail === 'string' && detail.trim()) return detail.trim().slice(0, 1000);
    if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
      const detailMessage = detail.message;
      if (typeof detailMessage === 'string' && detailMessage.trim()) {
        return detailMessage.trim().slice(0, 1000);
      }
      const issues = detail.issues;
      if (Array.isArray(issues)) {
        const messages = issues
          .map(issue => issue && typeof issue === 'object' && !Array.isArray(issue) ? issue.message : null)
          .filter((message): message is string => typeof message === 'string' && Boolean(message.trim()));
        if (messages.length) return messages.join('；').slice(0, 1000);
      }
    }
    if (typeof message === 'string' && message.trim()) return message.trim().slice(0, 1000);
  }
  return `chuanshen/http-${status}`;
}

export class ChuanshenClient {
  readonly options: ChuanshenClientOptions;
  #accessToken: string | undefined;

  constructor(options: ChuanshenClientOptions) {
    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000) throw new Error('chuanshen/config-invalid-timeout');
    this.options = { ...options, apiBaseUrl: normalizedBaseUrl(options.apiBaseUrl) };
  }

  async #credentials(): Promise<CredentialFile> {
    const metadata = await stat(this.options.credentialFile);
    if (!metadata.isFile()) throw new Error('chuanshen/credential-not-file');
    if ((metadata.mode & 0o077) !== 0) throw new Error('chuanshen/credential-permissions-too-open');
    const parsed = JSON.parse(await readFile(this.options.credentialFile, 'utf8')) as Partial<CredentialFile>;
    if (!parsed.username?.trim() || !parsed.password) throw new Error('chuanshen/credential-invalid');
    return { username: parsed.username.trim(), password: parsed.password };
  }

  async #login(signal: AbortSignal): Promise<void> {
    const credentials = await this.#credentials();
    const response = await this.#fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    }, signal, false);
    if (!response || typeof response !== 'object' || Array.isArray(response) || typeof response.access_token !== 'string') {
      throw new Error('chuanshen/login-missing-token');
    }
    this.#accessToken = response.access_token;
  }

  async #fetch(
    path: string,
    init: RequestInit,
    signal: AbortSignal,
    authenticated = true,
    retry = true,
  ): Promise<JsonValue> {
    if (authenticated && !this.#accessToken) await this.#login(signal);
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const combined = AbortSignal.any([signal, timeout]);
    const headers = new Headers(init.headers);
    if (authenticated && this.#accessToken) headers.set('Authorization', `Bearer ${this.#accessToken}`);
    const response = await fetch(`${this.options.apiBaseUrl}${path}`, { ...init, headers, signal: combined });
    const body = await response.json().catch(() => null) as JsonValue;
    if (response.status === 401 && authenticated && retry) {
      this.#accessToken = undefined;
      await this.#login(signal);
      return this.#fetch(path, init, signal, true, false);
    }
    if (!response.ok) throw new Error(errorMessage(body, response.status));
    return body;
  }

  get(path: string, signal: AbortSignal): Promise<JsonValue> {
    return this.#fetch(path, { method: 'GET' }, signal);
  }

  post(path: string, value: JsonValue, signal: AbortSignal): Promise<JsonValue> {
    return this.#fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    }, signal);
  }

  async postEventStream(
    path: string,
    value: JsonValue,
    signal: AbortSignal,
    timeoutMs = this.options.timeoutMs,
    retry = true,
  ): Promise<JsonValue> {
    if (!this.#accessToken) await this.#login(signal);
    const combined = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
    const response = await fetch(`${this.options.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.#accessToken}`,
      },
      body: JSON.stringify(value),
      signal: combined,
    });
    if (response.status === 401 && retry) {
      this.#accessToken = undefined;
      await this.#login(signal);
      return this.postEventStream(path, value, signal, timeoutMs, false);
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null) as JsonValue;
      throw new Error(errorMessage(body, response.status));
    }
    if (!response.body) throw new Error('chuanshen/stream-missing-body');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let bytes = 0;
    let eventCount = 0;
    let lastEvent = '';
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      bytes += chunk.byteLength;
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventCount += 1;
          lastEvent = line.slice(6).trim().slice(0, 120);
        }
      }
    }
    return { ok: true, status: response.status, event_count: eventCount, bytes, last_event: lastEvent };
  }

  async uploadDocument(
    input: {
      filePath: string;
      spaceId: string;
      targets: string[];
      materialRole: string;
      parserPolicyId?: string;
    },
    signal: AbortSignal,
  ): Promise<JsonValue> {
    const root = await realpath(resolve(this.options.allowedUploadRoot));
    const target = await realpath(resolve(input.filePath));
    const pathFromRoot = relative(root, target);
    if (pathFromRoot.startsWith('..') || isAbsolute(pathFromRoot)) throw new Error('chuanshen/upload-outside-allowed-root');
    const metadata = await stat(target);
    if (!metadata.isFile()) throw new Error('chuanshen/upload-not-file');
    if (metadata.size > 100 * 1024 * 1024) throw new Error('chuanshen/upload-too-large');
    const bytes = await readFile(target);
    const form = new FormData();
    form.set('space_id', input.spaceId);
    form.set('knowledge_processing_mode', 'both');
    form.set('knowledge_processing_targets', JSON.stringify(input.targets));
    form.set('material_role', input.materialRole);
    if (input.parserPolicyId) form.set('parser_policy_id', input.parserPolicyId);
    form.set('file', new Blob([bytes]), basename(target));
    return this.#fetch('/documents/upload', { method: 'POST', body: form }, signal);
  }
}

export function query(path: string, parameters: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, 'http://chuanshen.local');
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}
