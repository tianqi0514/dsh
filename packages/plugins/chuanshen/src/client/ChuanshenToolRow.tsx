import * as React from 'react';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import { CHUANSHEN_CAPABILITY_GROUPS, CHUANSHEN_TOOL_BY_NAME, CHUANSHEN_TOOL_PRESENTATIONS } from '../capabilities.js';
import { chuanshenPanelCss } from './styles.js';

function argsRaw(block: ToolCallViewProps['block']): string {
  return 'kind' in block ? block.call?.argsRaw ?? '' : block.argsRaw;
}

function resultText(block: ToolCallViewProps['block']): string {
  if (!('kind' in block)) return '';
  return block.content.map(part => {
    if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
    return JSON.stringify(part);
  }).join('\n');
}

function compactInput(raw: string): string {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const candidate = value.query ?? value.title ?? value.file_path ?? value.fact_key ?? value.space_id ?? value.project_id ?? value.document_id ?? value.run_id ?? value.job_id;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().split('/').at(-1)?.slice(0, 90) ?? candidate.slice(0, 90);
  } catch { /* Incomplete streaming arguments use the generic fallback. */ }
  return '';
}

export function ChuanshenToolRow({ toolName, block, inspect, openWritingResource }: ToolCallViewProps & {openWritingResource: (address: string) => void | Promise<unknown>}) {
  const [openError, setOpenError] = React.useState('');
  const presentation = (CHUANSHEN_TOOL_BY_NAME as ReadonlyMap<string, (typeof CHUANSHEN_TOOL_PRESENTATIONS)[number]>).get(toolName);
  const group = CHUANSHEN_CAPABILITY_GROUPS.find(item => item.id === presentation?.group);
  const settled = 'kind' in block;
  const failed = settled && block.isError;
  const state = failed ? 'error' : settled ? 'ok' : 'running';
  const input = argsRaw(block);
  const output = resultText(block);
  const address = !failed && settled && toolName === 'chuanshen_writing_open'
    ? output.match(/dsh-resource:\/\/chuanshen-writing\/[A-Za-z0-9_-]{1,100}(?=[\s)"'\\]|$)/)?.[0] : undefined;
  const compact = compactInput(input);
  return <div className={`wd-cs-tool ${state}`} data-testid={`chuanshen-tool-${toolName}`}>
    <style>{chuanshenPanelCss}</style>
    <div className="wd-cs-tool-head">
      <i className="wd-cs-tool-dot"/>
      <span className="wd-cs-tool-title">{presentation?.label ?? toolName}</span>
      {group && <span className="wd-cs-tool-group">{group.label}</span>}
      <span className="wd-cs-tool-summary">{compact || presentation?.summary || ''}</span>
      <span className="wd-cs-tool-state">{failed ? '失败' : settled ? '完成' : '执行中'}</span>
    </div>
    {address && <button type="button" onClick={() => { setOpenError(''); Promise.resolve().then(() => openWritingResource(address)).catch(() => setOpenError('请先展开右侧栏，再打开 Plate 写作。')); }}>在 Plate 打开文稿</button>}
    {openError && <div role="alert">{openError}</div>}
    {(input || output) && <details>
      <summary onDoubleClick={() => inspect?.()}>查看输入与结果</summary>
      <pre>{[input ? `输入\n${input}` : '', output ? `结果\n${output}` : ''].filter(Boolean).join('\n\n')}</pre>
    </details>}
  </div>;
}
