import * as React from 'react';
import type { ProjectSnapshot, ProjectWorkspace } from 'workdsh-contracts/projects';
import type { ProjectClient } from './management.js';

/** Chooses execution facts; recommendations are never presented as loaded methods. */
export function ProjectTaskComposition({ snapshot, management, expertId, selectExpert, updated, disabled }: {
  snapshot: ProjectSnapshot; management: ProjectClient; expertId?: string;
  selectExpert: (id?: string) => void; updated: (snapshot: ProjectSnapshot) => void; disabled: boolean;
}) {
  const [workspaces, setWorkspaces] = React.useState<readonly ProjectWorkspace[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    management.workspaces().then(rows => { if (active) setWorkspaces(rows); }).catch(() => { if (active) setError('工作空间暂不可用'); });
    return () => { active = false; };
  }, [management]);
  const chooseWorkspace = async (workspaceId: string) => {
    setSaving(true); setError('');
    try {
      await management.updateConfig(snapshot.project.id, { ...snapshot.config, workspaceId }, snapshot.config.id);
      updated(await management.get(snapshot.project.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : '执行位置保存失败'); }
    finally { setSaving(false); }
  };
  const experts = snapshot.config.capabilities.filter(row => row.kind === 'expert');
  return <div className="wd-p-task-composition">
    <label>执行位置 <select aria-label="项目执行工作空间" value={snapshot.config.workspaceId ?? ''} disabled={disabled || saving} onChange={event => void chooseWorkspace(event.target.value)}>
      <option value="" disabled>请选择工作空间</option>
      {workspaces.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
    </select></label>
    <label>本次主笔 <select aria-label="本次主笔" value={expertId ?? ''} disabled={disabled} onChange={event => selectExpert(event.target.value || undefined)}>
      <option value="">普通 Agent</option>
      {experts.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
    </select></label>
    <small>推荐技能按需加载，实际使用见任务记录。</small>
    {error && <span role="alert" className="wd-p-error">{error}</span>}
  </div>;
}
