import * as React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-connection/client';
import type {} from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-session/client';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type {} from '@deepseek-ai/dsh-api-session-controller/client';
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client';
import type { ProjectInputRef, ProjectSnapshot } from 'workdsh-contracts/projects';
import { createProjectClient } from './client/management.js';
import { publishProjectFocus, ProjectsPanel } from './client/ProjectsPanel.js';
import { ProjectLineageChip } from './client/components/project-lineage/ProjectLineageChip.js';
import { projectOperationId } from './client/operation-id.js';

declare module '@deepseek-ai/dsh-api-session-controller/client' { interface SessionReferenceSourceMap { workdshProjectTaskStart: unknown; } }
export const name = 'workdsh-projects-client';
export const inject = ['slots', 'layout', 'connection', 'sessions', 'workspaces', 'conversation', 'uiWorkspace'];

export function apply(ctx: Context): void {
  const lifetime = new AbortController();
  ctx.effect(() => () => lifetime.abort(), 'workdsh.projects.client');
  const management = createProjectClient(lifetime.signal);
  const sessions = ctx.sessions as unknown as ISessions;
  const wait = (milliseconds: number) => new Promise<void>((resolve, reject) => {
    lifetime.signal.throwIfAborted();
    const onAbort = () => { window.clearTimeout(timer); reject(lifetime.signal.reason); };
    const timer = window.setTimeout(() => { lifetime.signal.removeEventListener('abort', onAbort); resolve(); }, milliseconds);
    lifetime.signal.addEventListener('abort', onAbort, { once: true });
  });
  const startTask = async (snapshot: ProjectSnapshot, prompt: string, references: readonly ProjectInputRef[], expertId?: string): Promise<string> => {
    const validated = await management.validateInputRefs(snapshot.project.id, references);
    const plan = await management.prepareTask(snapshot.project.id, snapshot.config.id, expertId);
    const workspace = ctx.workspaces.list.getSnapshot().items.find(row => String(row.workspaceId) === plan.workspace.id);
    if (!workspace) throw new Error('项目执行位置不可用，请重新选择工作空间。');
    const sessionId = plan.expert
      ? (await management.createExpertTask(snapshot.project.id, plan.configRevisionId, plan.expert.id, projectOperationId())).sessionId as Awaited<ReturnType<ISessions['create']>>
      : await sessions.create({ workspaceId: workspace.workspaceId, cwd: workspace.path });
    const id = String(sessionId);
    if (plan.expert) await sessions.refresh();
    const invoke = async (path: string, endpoint: string, payload: unknown) => {
      const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint, payload }) });
      const result = await response.json().catch(() => undefined) as { ok?: boolean; error?: { message?: string } } | undefined;
      // Selection sync must not continue into the send on a silent failure; the
      // native route returns the same { ok, error } envelope as the project API.
      if (!response.ok || !result?.ok) throw new Error(result?.error?.message ?? `任务选择同步失败（${response.status}）`);
    };
    const selectedAssetIds = new Set(validated.filter(row => row.kind === 'asset').map(row => row.id)), assets = snapshot.assets.filter(row => selectedAssetIds.has(row.id));
    if (assets.length) await invoke('/api/workdsh-library', 'set-task-selection', { sessionId: id, nodeIds: assets.map(row => row.nodeId) });
    const connectors = snapshot.config.capabilities.filter(row => row.kind === 'connector').map(row => row.id);
    // Explicit empty selection is intentional; never inherit another Session's connectors.
    await invoke('/api/workdsh-connectors', 'set-selection', { sessionId: id, connectorIds: connectors });
    const visibleReferences = validated.map(row => `${row.kind === 'asset' ? '@资料库' : '@项目'}/${row.label}`).join(' ');
    // alpha.2: scopes only borrow retained generations, so hold an owned reference across
    // the shared initial open and the send, releasing it on every path. Session scopes
    // expose services through get(); property access needs an inject accessor those contexts never get.
    const reference = sessions.retain(sessionId, { source: 'workdshProjectTaskStart', signal: lifetime.signal });
    try {
      // A failed shared open must stay a recoverable retry, not a raw controller error.
      try { await reference.ready; } catch { throw new Error('项目会话尚未就绪，请重试。'); }
      for (let attempt = 0; attempt < 40; attempt++) {
        const conversation = reference.binding.ctx.get('conversation');
        if (conversation) {
          // The task link lands immediately before the first send: a failed open or a
          // Session that never becomes sendable must not leave an orphan task record,
          // and a later send failure states the created-task fact explicitly.
          await management.linkTask(snapshot.project.id, id, prompt.slice(0, 80) || snapshot.project.name, undefined, validated, plan.configRevisionId);
          try {
            await conversation.send([prompt, visibleReferences].filter(Boolean).join('\n'));
          } catch {
            throw new Error('任务已创建，但首条消息发送失败；可从项目任务列表打开该会话重发。');
          }
          return id;
        }
        await wait(25);
      }
    } finally { reference.release(); }
    throw new Error('项目会话尚未就绪，请重试。');
  };
  // Opening a task is official Session navigation: the Session becomes current and the
  // layout returns to the built-in conversation view, whose shell owns message history,
  // streaming, composer, model and permissions. WorkDSH keeps no second conversation
  // renderer or send path for project tasks.
  // A reload-restored snapshot can mount before the session list pull lands; retry briefly instead of failing loud.
  const openTask = (sessionId: string, onFailed?: () => void): void => {
    const attempt = (remaining: number): void => {
      try { ctx.uiWorkspace.openSession(sessionId as Parameters<typeof ctx.uiWorkspace.openSession>[0]); ctx.layout.selectPanel(null); }
      catch { if (remaining > 0) window.setTimeout(() => attempt(remaining - 1), 200); else onFailed?.(); }
    };
    attempt(25);
  };
  // Lineage chip navigation: the URL argument restores the project when the panel is not
  // mounted yet, while the focus channel switches an already-mounted panel in place.
  const focusProject = (projectId: string): void => {
    const url = new URL(window.location.href);
    url.searchParams.set('project', projectId);
    url.searchParams.delete('task');
    window.history.replaceState(window.history.state, '', url);
    publishProjectFocus(projectId);
    const attemptPanel = (remaining: number): void => {
      try { ctx.layout.selectPanel('workdsh-projects' as Parameters<typeof ctx.layout.selectPanel>[0]); }
      catch { if (remaining > 0) window.setTimeout(() => attemptPanel(remaining - 1), 200); }
    };
    attemptPanel(25);
  };
  // Title-adjacent chip (order -20; official header actions occupy -10 to 20). It renders
  // nothing outside project task sessions, so native headers stay untouched elsewhere.
  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'workdsh-project-lineage',
      order: -20,
      inject: () => ({ management, focusProject }),
    }, ProjectLineageChip));
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'workdsh-projects', inject: () => ({ management, startTask, openTask }) }, ProjectsPanel));
}
