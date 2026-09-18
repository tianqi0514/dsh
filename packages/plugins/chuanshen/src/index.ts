import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-system-prompt';
import type {} from '@deepseek-ai/dsh-tools';
import { resolve } from 'node:path';
import { ChuanshenClient } from './client.js';
import { CHUANSHEN_WORKFLOW_PROMPT } from './prompt.js';
import { registerChuanshenTools } from './tools.js';

export * from './client.js';
export * from './tools.js';
export { CHUANSHEN_WORKFLOW_PROMPT } from './prompt.js';

export const name = 'workdsh-plugin-chuanshen';
export const inject = ['tools', 'systemPrompt'];

export function apply(ctx: Context): void {
  const client = new ChuanshenClient({
    apiBaseUrl: process.env.CHUANSHEN_API_BASE_URL ?? 'http://127.0.0.1:9002/api/v1',
    credentialFile: resolve(process.env.CHUANSHEN_CREDENTIAL_FILE ?? '.secrets/chuanshen-platform.json'),
    allowedUploadRoot: resolve(process.env.CHUANSHEN_ALLOWED_UPLOAD_ROOT ?? 'workspace/chuanshen-upload'),
    timeoutMs: Number(process.env.CHUANSHEN_TOOL_TIMEOUT_MS ?? 120_000),
  });
  registerChuanshenTools(ctx, client);
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'workdsh:chuanshen-platform',
    order: ctx.systemPrompt.getSectionOrder('TOOL_REPORT'),
    text: CHUANSHEN_WORKFLOW_PROMPT,
  }));
}
