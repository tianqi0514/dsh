import type { ActorContext } from 'workdsh-contracts';
import type { ExpertsService } from 'workdsh-contracts/experts';
import type { ProjectService, ProjectTaskPlan, ProjectWorkspace } from 'workdsh-contracts/projects';

/** Resolve only the project's explicit immutable configuration, never the active tab. */
export async function prepareProjectTask(
  projects: ProjectService, actor: ActorContext, projectId: string,
  expectedConfigRevisionId: string, workspaces: readonly ProjectWorkspace[], expertId?: string,
  signal?: AbortSignal,
): Promise<ProjectTaskPlan> {
  signal?.throwIfAborted();
  const snapshot = await projects.get(actor, projectId, signal);
  if (snapshot.config.id !== expectedConfigRevisionId) throw new Error('projects/revision-conflict');
  const workspace = workspaces.find(row => row.id === snapshot.config.workspaceId);
  if (!workspace) throw new Error('projects/workspace-required');
  const expert = expertId ? snapshot.config.capabilities.find(row => row.kind === 'expert' && row.id === expertId) : undefined;
  if (expertId && (!expert || !expert.revision)) throw new Error('projects/expert-unavailable');
  return { configRevisionId: snapshot.config.id, workspace, ...(expert ? { expert } : {}) };
}

/** Public ExpertsService owns preset assembly, authorization and native Session creation. */
export async function createProjectExpertSession(
  experts: ExpertsService, actor: ActorContext, plan: ProjectTaskPlan,
  operationId: string, signal?: AbortSignal,
): Promise<string> {
  if (!plan.expert?.revision) throw new Error('projects/expert-unavailable');
  const execution = await experts.prepareExecution(actor, plan.expert.id, plan.expert.revision,
    plan.workspace.path, undefined, undefined, signal, plan.workspace.id);
  if (execution.missing.length) throw new Error('projects/expert-unavailable');
  // A legacy preset migration must be an explicit project configuration upgrade.
  if (execution.expertRevisionRef.revisionId !== plan.expert.revision) throw new Error('projects/expert-revision-changed');
  const creation = await experts.createExecution(actor, execution.executionPlanId, { operationId }, signal);
  return creation.sessionId;
}
