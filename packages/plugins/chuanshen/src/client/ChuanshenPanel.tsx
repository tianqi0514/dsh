import * as React from 'react';
import { CHUANSHEN_CAPABILITY_GROUPS } from '../capabilities.js';
import type { ChuanshenManagementClient, ChuanshenOverview, ChuanshenSpaceOverview } from './management.js';
import { chuanshenPanelCss } from './styles.js';

interface Props {
  management: ChuanshenManagementClient;
  startConversation(prompt: string): Promise<void>;
}

const prompts = {
  ingest: '请使用传神智库插件接入一份业务材料。先列出我可用的知识空间并让我选择，然后等待我提供文件。加工目标默认包含全文、向量、知识图谱和写作图谱；每一步核对真实任务终态，不要把任务创建说成完成。',
  report: '请使用传神智库完成一次可控推演写作。先列出写作项目并让我选择，再核对已确认事实、写作图谱、确定性测算和 Semantica 推演条件；按章节生成有依据的报告，并检查 Chunk 绑定。缺少依据时明确标记，不要编造。',
  impact: '请使用传神智库演示一次事实变更联动。先让我选择写作项目、文稿和一个已核验事实；修改前必须生成影响预览，列出直接影响、间接影响、修改前后和 stale 项，等待我选择后才应用，禁止字符串全局替换或整篇重写。',
};

function statusLabel(status: ChuanshenOverview['status']): string {
  return status === 'connected' ? '智库已连接' : status === 'partial' ? '部分能力可用' : '智库不可用';
}

export function ChuanshenPanel({ management, startConversation }: Props) {
  const [overview, setOverview] = React.useState<ChuanshenOverview>();
  const [space, setSpace] = React.useState<ChuanshenSpaceOverview>();
  const [selectedSpaceId, setSelectedSpaceId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  const refresh = React.useCallback(async () => {
    setBusy(true); setError('');
    try {
      const next = await management.overview();
      setOverview(next);
      setSelectedSpaceId(current => current && next.spaces.some(item => item.id === current) ? current : next.spaces[0]?.id ?? '');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '暂时无法读取传神智库。'); }
    finally { setBusy(false); }
  }, [management]);

  React.useEffect(() => { void refresh(); }, [refresh]);
  React.useEffect(() => {
    if (!selectedSpaceId) { setSpace(undefined); return; }
    const current = selectedSpaceId;
    void management.spaceOverview(current).then(value => { if (value.spaceId === current) setSpace(value); }).catch(cause => setError(cause instanceof Error ? cause.message : '无法读取空间状态。'));
  }, [management, selectedSpaceId]);

  const run = async (prompt: string) => {
    setBusy(true); setError('');
    try { await startConversation(prompt); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '无法创建智库任务。'); setBusy(false); }
  };

  if (!overview && busy) return <div className="wd-cs"><style>{chuanshenPanelCss}</style><div className="wd-cs-loading">正在连接传神智库…</div></div>;
  return <section className="wd-cs" data-testid="workdsh-chuanshen">
    <style>{chuanshenPanelCss}</style>
    <div className="wd-cs-shell">
      <header className="wd-cs-header">
        <div><p className="wd-cs-eyebrow">DSH 原生能力插件</p><h1>传神智库</h1><p className="wd-cs-subtitle">资料进入，形成知识，完成推演、写作与联动更新。</p></div>
        <div className={`wd-cs-status ${overview?.status ?? 'unavailable'}`}><i/>{statusLabel(overview?.status ?? 'unavailable')}</div>
      </header>
      <div className="wd-cs-actions">
        <button className="wd-cs-primary" disabled={busy} onClick={() => void run(prompts.ingest)}>接入并加工资料</button>
        <button className="wd-cs-secondary" disabled={busy} onClick={() => void run(prompts.report)}>生成推演报告</button>
        <button className="wd-cs-secondary" disabled={busy} onClick={() => void run(prompts.impact)}>演示事实联动</button>
        <button className="wd-cs-secondary" disabled={busy} onClick={() => void refresh()}>刷新状态</button>
      </div>
      {error && <div className="wd-cs-error" role="alert">{error}</div>}
      <div className="wd-cs-metrics">
        <div className="wd-cs-metric"><small>原生工具</small><strong>{overview?.toolCount ?? 0}</strong></div>
        <div className="wd-cs-metric"><small>知识空间</small><strong>{overview?.spaces.length ?? 0}</strong></div>
        <div className="wd-cs-metric"><small>写作项目</small><strong>{overview?.projects.length ?? 0}</strong></div>
        <div className="wd-cs-metric"><small>规则任务</small><strong>{overview?.analysisTasks.length ?? 0}</strong></div>
      </div>

      <section className="wd-cs-section"><div className="wd-cs-section-head"><h2>能力链路</h2><span className="wd-cs-note">所有操作仍由 DSH Agent 调用真实工具</span></div>
        <div className="wd-cs-flow">{(overview?.capabilityGroups ?? CHUANSHEN_CAPABILITY_GROUPS.map(group => ({ ...group, toolCount: 0 }))).map(group =>
          <article className="wd-cs-capability" style={{ '--accent': group.accent } as React.CSSProperties} key={group.id}><strong>{group.label}</strong><p>{group.description}</p><span>{group.toolCount} 个工具</span></article>)}</div>
      </section>

      <section className="wd-cs-section"><div className="wd-cs-section-head"><h2>空间实况</h2>{overview?.spaces.length ? <select aria-label="知识空间" value={selectedSpaceId} onChange={event => setSelectedSpaceId(event.target.value)}>{overview.spaces.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select> : null}</div>
        {!overview?.spaces.length ? <div className="wd-cs-card wd-cs-empty">当前账号没有可用知识空间。</div> : <div className="wd-cs-space">
          <div className="wd-cs-card"><h3>加工与推演</h3><div className="wd-cs-list"><div className="wd-cs-list-row"><span>文档</span><strong>{space?.documentCount ?? '—'}</strong></div><div className="wd-cs-list-row"><span>后台任务</span><strong>{space?.jobCount ?? '—'}</strong></div><div className="wd-cs-list-row"><span>规则推演</span><strong>{space ? (space.reasoning.ready ? '已就绪' : `${space.reasoning.blockerCount} 项待处理`) : '—'}</strong></div></div><p className="wd-cs-note">任务状态来自智库实时接口，不使用前端模拟进度。</p></div>
          <div className="wd-cs-card"><h3>写作图谱五层</h3><div className="wd-cs-graph">{(space?.writingGraph ?? []).map(layer => <div className="wd-cs-layer" key={layer.id}><span>{layer.label}</span><strong>{layer.total}</strong><span>已确认 {layer.verified} · 待确认 {layer.pending}</span></div>)}</div>{!space?.writingGraph.length && <div className="wd-cs-empty">正在读取写作图谱…</div>}</div>
        </div>}
      </section>

      <section className="wd-cs-section"><div className="wd-cs-section-head"><h2>最近写作项目</h2></div><div className="wd-cs-card"><div className="wd-cs-list">{overview?.projects.slice(0, 6).map(project => <div className="wd-cs-list-row" key={project.id}><span>{project.name}</span><small>{project.status ?? '当前项目'}</small></div>)}{!overview?.projects.length && <div className="wd-cs-empty">暂无写作项目，可在对话中直接创建。</div>}</div></div></section>
    </div>
  </section>;
}
