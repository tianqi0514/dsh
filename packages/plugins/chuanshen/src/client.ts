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
