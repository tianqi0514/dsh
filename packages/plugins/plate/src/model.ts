export type Node = {id?: string; type?: string; text?: string; children?: Node[]; writing_binding?: Record<string, unknown>; [key:string]:unknown};
export type Version = {id:string; version:number; content:Node[]; status:string};
export type Document = {id:string; title:string; project_id:string; current_version_id:string; current_version:Version};
export type Row = Record<string, any>;
export type Rpc = <T>(endpoint:string, payload?:Record<string, unknown>, signal?:AbortSignal)=>Promise<T>;
export function newId():string{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const s=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;}
export function resourceAddress(id:string):string { if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('无效文稿'); return `dsh-resource://chuanshen-writing/${id}`; }
export function documentId(address:string):string|undefined {return /^dsh-resource:\/\/chuanshen-writing\/([a-zA-Z0-9_-]{1,100})$/.exec(address)?.[1];}
export function rows(value:any):Row[]{return Array.isArray(value)?value:Array.isArray(value?.items)?value.items:Array.isArray(value?.documents)?value.documents:Array.isArray(value?.paragraphs)?value.paragraphs:[];}
export function exportReady(row:Row):boolean{
 const status=String(row.status??'').trim().toLowerCase();
 return (status==='succeeded'||status==='completed')&&typeof row.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(row.id);
}
export function displayValue(value:unknown):string{
 if(value===null||value===undefined)return '未提供';
 if(typeof value==='string'||typeof value==='boolean')return String(value);
 if(typeof value==='number')return Number.isFinite(value)?String(value):'无效数值';
 if(typeof value==='object'&&!Array.isArray(value)){const item=value as Row;for(const key of ['number','value','text'])if(Object.hasOwn(item,key))return displayValue(item[key]);}
 return '查看详情';
}
export function statusLabel(status:unknown):string{return ({verified:'已确认',unverified:'待核验',candidate:'待确认',current:'当前有效',stale:'需更新',invalid:'已失效',superseded:'历史版本',manual_override:'人工覆盖',rejected:'已拒绝',conflicted:'有冲突',published:'已定稿'} as Record<string,string>)[String(status)]??'待核验';}
export type EvidenceCard={title:string;kind:string;excerpt:string;version:string;location:string;verification:string;freshness:string};
export function evidenceCards(paragraph:Row):EvidenceCard[]{
 const dependencies=rows(paragraph.dependencies),records=dependencies.length?dependencies:rows(paragraph.evidence);
 return records.map(item=>{
  const snapshot=item.snapshot??item.metadata??{};
  const kind=({source_chunk:'来源片段',writing_evidence:'来源依据',writing_fact:'已采纳事实',project_fact:'项目事实',writing_relation:'关系依据',computation:'确定性计算',computation_run:'确定性计算',public_reference:'公开引用',model_extraction:'来源绑定',inferred_fact:'推演结论'} as Record<string,string>)[String(item.type)]??'来源依据';
  const title=String(snapshot.document_title??snapshot.filename??snapshot.file_name??snapshot.title??snapshot.label??snapshot.canonical_name??kind);
  const rawText=snapshot.text??snapshot.excerpt??snapshot.original_text??snapshot.quote;
  const excerpt=typeof rawText==='string'?rawText:Object.hasOwn(snapshot,'value')?`${displayValue(snapshot.value)}${snapshot.unit??''}`:snapshot.result&&Object.hasOwn(snapshot.result,'value')?`${displayValue(snapshot.result.value)}${snapshot.unit??snapshot.result.unit??''}`:'此条绑定尚未返回来源原文。';
  const rawVersion=snapshot.document_version??snapshot.version_number??snapshot.version??snapshot.formula?.version??item.version;
  const version=typeof rawVersion==='number'||typeof rawVersion==='string'&&/^\d+$/.test(rawVersion)?`V${rawVersion}`:snapshot.document_version_id||rawVersion?'已锁定来源版本':'未提供版本信息';
  const page=snapshot.page_number??snapshot.page;
  const location=[page!==null&&page!==undefined?`第 ${page} 页`:'',snapshot.structural_path??snapshot.location??''].filter(Boolean).join(' · ');
  return {title,kind,excerpt,version,location,verification:statusLabel(item.verification??snapshot.verification_status),freshness:statusLabel(item.freshness??item.status??paragraph.status)};
 });
}
export function plain(node:Node):string{return typeof node.text==='string'?node.text:(node.children??[]).map(plain).join('');}
export function stableNodes(nodes:Node[]):Node[]{const seen=new Set<string>(); const visit=(n:Node):Node=>{const copy={...n}; if(copy.children){if(!copy.id||seen.has(copy.id)) copy.id=newId(); seen.add(copy.id); copy.children=copy.children.map(visit);}return copy;}; return nodes.map(visit);}
export function selectedImpactIds(proposals:Row[],selected:string[]):string[]{const permitted=new Set(proposals.filter(p=>p.selectable===true&&typeof p.block_id==='string').map(p=>p.block_id));return [...new Set(selected)].filter(id=>permitted.has(id));}
export type ControlledEditIssue={message:string;factKey:string};
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
/** Client feedback only; the authoritative save endpoint repeats these checks. */
export function controlledEditIssue(before:Node[],after:Node[]):ControlledEditIssue|undefined{
 const collect=(nodes:Node[])=>{const map=new Map<string,{node:Node;blockId:string}>();let invalid:ControlledEditIssue|undefined;const walk=(n:Node,blockId:string)=>{const b=n.writing_binding;if(b){const id=String(b.occurrence_id??'');if(!id||map.has(id))invalid={message:'数值位置重复，请通过依据插入受控内容',factKey:String(b.fact_key??'')};map.set(id,{node:n,blockId});}for(const child of n.children??[])walk(child,blockId);};for(const n of nodes)walk(n,String(n.id??''));return {map,invalid};};
 const prior=collect(before),next=collect(after);if(next.invalid)return next.invalid;
 for(const [id,current] of next.map){const old=prior.map.get(id);if(!old||plain(old.node)!==plain(current.node)||canonical(old.node.writing_binding)!==canonical(current.node.writing_binding))return {message:'受控数值请通过“调整输入”预览修改',factKey:String(current.node.writing_binding?.fact_key??'')};}
 const surviving=new Set(after.map(n=>n.id));for(const [id,old] of prior.map)if(!next.map.has(id)&&surviving.has(old.blockId))return {message:'本段数值已绑定依据，删除或修改请先调整输入',factKey:String(old.node.writing_binding?.fact_key??'')};
}
export const css=`.wd-plate{height:100%;display:flex;flex-direction:column;min-width:0;overflow:hidden;background:#202020;color:#e7e7e7;font:14px/1.6 system-ui}.wd-plate *{box-sizing:border-box}.wd-plate button,.wd-plate select,.wd-plate input{font:inherit;border:1px solid #555;border-radius:6px;background:#303030;color:inherit;padding:5px 9px;max-width:100%}.wd-plate button{cursor:pointer}.wd-plate button:disabled{opacity:.5;cursor:not-allowed}.wd-plate header,.wd-plate nav,.wd-plate .toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:8px;border-bottom:1px solid #444}.wd-plate header strong{flex:1}.wd-plate .body{flex:1;min-height:0;overflow:auto;padding:14px;background:#ddd}.wd-plate .paper{background:white;color:#222;padding:32px;max-width:900px;min-height:560px;margin:auto;overflow-wrap:anywhere}.wd-plate .paper h1{font-size:26px}.wd-plate .paper h2{font-size:21px}.wd-plate .paper p{margin:8px 0}.wd-plate .paper table{border-collapse:collapse;width:100%;table-layout:fixed}.wd-plate .paper td,.wd-plate .paper th{border:1px solid #aaa;padding:8px;min-width:40px}.wd-plate .paper img{max-width:100%}.wd-plate .paper a{color:#285ac6}.wd-plate .paper [data-controlled]{border-bottom:1px dotted #667;cursor:pointer}.wd-plate .status{padding:5px 10px;min-height:30px}.wd-plate .error{color:#ffb9b9;white-space:pre-wrap}.wd-plate .details{overflow:auto;padding:12px;min-height:0}.wd-plate .details article{border-bottom:1px solid #444;padding:10px 0}.wd-plate .details pre{white-space:pre-wrap;overflow-wrap:anywhere}.wd-plate .overlay{position:absolute;inset:0;z-index:30;background:#0009;display:flex;align-items:center;justify-content:center;padding:12px}.wd-plate .dialog{background:#242424;border:1px solid #666;border-radius:10px;width:min(820px,100%);max-height:95%;overflow:auto;padding:16px}.wd-plate .dialog h3{margin-top:0}.wd-plate .dialog article{border:1px solid #555;padding:10px;margin:8px 0;white-space:pre-wrap}.wd-plate .dialog footer{position:sticky;bottom:-16px;background:#242424;padding:12px 0;display:flex;gap:8px;justify-content:flex-end}.wd-plate .dialog label{display:block}.wd-plate .dialog .before{color:#e0aaaa}.wd-plate .dialog .after{color:#afd5b5}.wd-plate .slash{position:absolute;background:white;color:#222;box-shadow:0 4px 20px #0004;z-index:10;padding:8px;border-radius:8px;display:flex;flex-direction:column;min-width:160px}.wd-plate .slash button{background:white;color:#222;text-align:left}.wd-plate .picker{padding:12px;overflow:auto}.wd-plate .picker button{display:block;margin:8px 0;width:100%;text-align:left}@media(max-width:700px){.wd-plate .paper{padding:18px}.wd-plate .body{padding:8px}}`;
