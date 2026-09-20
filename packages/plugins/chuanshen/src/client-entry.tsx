import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-connection/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-session/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-tool/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-api-session-controller/client';
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client';
import { CHUANSHEN_TOOL_PRESENTATIONS } from './capabilities.js';
import { createChuanshenManagementClient } from './client/management.js';
import { ChuanshenPanel } from './client/ChuanshenPanel.js';
import { ChuanshenToolRow } from './client/ChuanshenToolRow.js';

declare module '@deepseek-ai/dsh-api-session-controller/client' {
  interface SessionReferenceSourceMap { workdshChuanshenTaskStart: unknown; }
}

export const name = 'workdsh-chuanshen-client';
export const inject = ['slots', 'layout', 'connection', 'sessions', 'workspaces', 'conversation', 'uiWorkspace'];

export function apply(ctx: Context): void {
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort(), 'workdsh.chuanshen.client');
  const management = createChuanshenManagementClient(lifetime.signal);
  const sessions = ctx.sessions as unknown as ISessions;
  const wait = (milliseconds: number) => new Promise<void>((resolve, reject) => {
    lifetime.signal.throwIfAborted();
    const onAbort = () => { window.clearTimeout(timer); reject(lifetime.signal.reason); };
    const timer = window.setTimeout(() => { lifetime.signal.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
    lifetime.signal.addEventListener('abort', onAbort, { once: true });
  });
  const startConversation = async (prompt: string): Promise<void> => {
    const state = sessions.list.getSnapshot();
    const currentId = Object.values(state.byId).find(row => (row.retainedBy.mainView ?? 0) > 0)?.id;
    const current = currentId ? state.byId[currentId] : undefined;
    const workspaces = ctx.workspaces.list.getSnapshot().items;
    const workspace = (currentId ? workspaces.find(row => row.sessionIds.includes(currentId)) : undefined)
      ?? workspaces.find(row => row.path === current?.cwd)
      ?? workspaces[0];
    if (!workspace) throw new Error('请先选择工作空间。');
    const sessionId = await sessions.create({ workspaceId: workspace.workspaceId, cwd: workspace.path });
    const reference = sessions.retain(sessionId, { source: 'workdshChuanshenTaskStart', signal: lifetime.signal });
    try {
      await reference.ready;
      for (let attempt = 0; attempt < 40; attempt++) {
        const conversation = reference.binding.ctx.get('conversation');
        if (conversation) {
          ctx.uiWorkspace.openSession(sessionId as Parameters<typeof ctx.uiWorkspace.openSession>[0]);
          ctx.layout.selectPanel(null);
          await conversation.send(prompt);
          return;
        }
        await wait(25);
      }
    } finally { reference.release(); }
    throw new Error('智库会话尚未就绪，请重试。');
  };

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: 'workdsh-chuanshen',
    inject: () => ({ management, startConversation }),
  }, ChuanshenPanel));

  for (const tool of CHUANSHEN_TOOL_PRESENTATIONS) {
    ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
      name: 'tool.call.toolview',
      key: tool.name,
    }, ChuanshenToolRow));
  }
}
