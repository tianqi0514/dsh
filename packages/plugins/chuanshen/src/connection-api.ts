import type { Context } from '@deepseek-ai/cordis';
import type { ConnectionRpcResult, HostConnectionHandle } from '@deepseek-ai/dsh-client-connection';
import type { ChuanshenClient } from './client.js';
import { buildChuanshenOverview, buildChuanshenSpaceOverview } from './overview.js';

export const chuanshenManagementPath = '/api/workdsh-chuanshen';

const ok = <T>(value: T): ConnectionRpcResult<T> => ({ ok: true, value });
const fail = (code: string, message: string): ConnectionRpcResult<never> => ({ ok: false, error: { code, message, details: {} } });

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

export function registerChuanshenConnection(ctx: Context, client: ChuanshenClient): void {
  const connection = (ctx as Context & { connection: HostConnectionHandle }).connection;
  const unregister = connection.fetch.register({
    path: chuanshenManagementPath,
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async request => {
      try {
        const body = record(await request.json());
        const endpoint = body?.endpoint;
        const payload = record(body?.payload) ?? {};
        if (endpoint === 'overview') return Response.json(ok(await buildChuanshenOverview(client, request.signal)));
        if (endpoint === 'space-overview' && typeof payload.spaceId === 'string' && payload.spaceId.trim()) {
          return Response.json(ok(await buildChuanshenSpaceOverview(client, payload.spaceId.trim(), request.signal)));
        }
        return Response.json(fail('chuanshen/invalid-request', '传神智库请求无效。'), { status: 400 });
      } catch (cause) {
        const code = cause instanceof Error && cause.message.startsWith('chuanshen/') ? cause.message : 'chuanshen/internal';
        const messages: Record<string, string> = {
          'chuanshen/credential-not-file': '传神智库凭据尚未配置。',
          'chuanshen/credential-permissions-too-open': '传神智库凭据文件权限不安全。',
          'chuanshen/credential-invalid': '传神智库凭据格式无效。',
          'chuanshen/login-missing-token': '传神智库登录失败。',
        };
        return Response.json(fail(code, messages[code] ?? '暂时无法读取传神智库，请稍后重试。'), { status: code === 'chuanshen/internal' ? 500 : 503 });
      }
    },
  });
  ctx.effect(() => unregister, 'workdsh.chuanshen.fetch');
}
