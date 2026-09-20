import React, {createContext, useContext, useId, useRef, useState} from 'react';
import {Plate, PlateContent, PlateElement, PlateLeaf, ParagraphPlugin, usePlateEditor, createPlatePlugin, type PlateElementProps, type PlateLeafProps} from 'platejs/react';
import {KEYS, type Value} from 'platejs';
import {H1Plugin,H2Plugin,H3Plugin,BlockquotePlugin,BoldPlugin,ItalicPlugin,UnderlinePlugin,StrikethroughPlugin} from '@platejs/basic-nodes/react';
import {FontFamilyPlugin,FontSizePlugin,LineHeightPlugin,TextAlignPlugin} from '@platejs/basic-styles/react';
import {ListPlugin} from '@platejs/list/react';
import {IndentPlugin} from '@platejs/indent/react';
import {TablePlugin,TableRowPlugin,TableCellPlugin,TableCellHeaderPlugin} from '@platejs/table/react';
import {LinkPlugin} from '@platejs/link/react';
import {ImagePlugin} from '@platejs/media/react';
import {SlashPlugin,SlashInputPlugin} from '@platejs/slash-command/react';
import {useComboboxInput,useHTMLInputCursorState} from '@platejs/combobox/react';
import {controlledEditIssue,newId,type Node} from './model.js';

const SourceContext=createContext<(key:string)=>void>(()=>undefined);
const P=(p:PlateElementProps)=><PlateElement {...p} as="p" style={p.element.listStyleType?{display:'list-item',listStyleType:String(p.element.listStyleType),marginLeft:24}:undefined}/>;
const H1=(p:PlateElementProps)=><PlateElement {...p} as="h1"/>;
const H2=(p:PlateElementProps)=><PlateElement {...p} as="h2"/>;
const H3=(p:PlateElementProps)=><PlateElement {...p} as="h3"/>;
const Table=(p:PlateElementProps)=><PlateElement {...p} as="table"><tbody>{p.children}</tbody></PlateElement>;
const Tr=(p:PlateElementProps)=><PlateElement {...p} as="tr"/>;
const Td=(p:PlateElementProps)=><PlateElement {...p} as="td"/>;
const Th=(p:PlateElementProps)=><PlateElement {...p} as="th"/>;
const Quote=(p:PlateElementProps)=><PlateElement {...p} as="blockquote"/>;
const Bold=(p:PlateLeafProps)=><PlateLeaf {...p} as="strong"/>;
const Italic=(p:PlateLeafProps)=><PlateLeaf {...p} as="em"/>;
const Underline=(p:PlateLeafProps)=><PlateLeaf {...p} as="u"/>;
const Strike=(p:PlateLeafProps)=><PlateLeaf {...p} as="s"/>;
const safeUrl=(u:unknown)=>typeof u==='string'&&/^https?:\/\//i.test(u)?u:undefined;
const Link=(p:PlateElementProps)=><PlateElement {...p} as="a" attributes={{...p.attributes,href:safeUrl(p.element.url),rel:'noreferrer'}}/>;
const Image=(p:PlateElementProps)=><PlateElement {...p}><img src={safeUrl(p.element.url)} alt={String(p.element.caption??'')} contentEditable={false}/>{p.children}</PlateElement>;

function Bound(p:PlateLeafProps){
 const open=useContext(SourceContext), binding=p.leaf.writing_binding as Record<string,unknown>;
 return <PlateLeaf {...p} attributes={{...p.attributes,'data-controlled':true,role:'button',tabIndex:0,
  title:'查看数值依据或调整输入',contentEditable:false,
  onMouseDown:(e:React.MouseEvent)=>e.preventDefault(),onClick:()=>open(String(binding?.fact_key??'')),
  onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(String(binding?.fact_key??''));}}}}/>;
}

export const slashCommands=[
 {label:'正文',kind:'p',keywords:'paragraph text'},
 {label:'一级标题',kind:'h1',keywords:'heading title'},
 {label:'二级标题',kind:'h2',keywords:'heading section'},
 {label:'三级标题',kind:'h3',keywords:'heading subsection'},
 {label:'引用',kind:'blockquote',keywords:'quote'},
 {label:'无序列表',kind:'disc',keywords:'bullet list'},
 {label:'有序列表',kind:'decimal',keywords:'number ordered list'},
 {label:'表格',kind:'table',keywords:'table'},
];

/** Official Slash/Combobox plugins own trigger insertion and cancellation. */
function Slash(p:PlateElementProps){
 const input=useRef<HTMLInputElement>(null),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const optionsId=useId();
 const cursorState=useHTMLInputCursorState(input);
 const {props:inputProps,removeInput}=useComboboxInput({ref:input,autoFocus:true,cursorState,cancelInputOnBlur:true,
  onCancelInput:cause=>{if(cause!=='backspace')p.editor.tf.insertText(`/${query}`);}});
 const options=slashCommands.filter(item=>`${item.label} ${item.kind} ${item.keywords}`.toLowerCase().includes(query.toLowerCase()));
 const run=(kind:string)=>{
  removeInput(true);
  if(kind==='table')p.editor.getTransforms(TablePlugin).insert.table({rowCount:3,colCount:3},{select:true});
  else p.editor.tf.setNodes({type:['disc','decimal'].includes(kind)?'p':kind,
    listStyleType:['disc','decimal'].includes(kind)?kind:undefined,indent:['disc','decimal'].includes(kind)?1:undefined});
  p.editor.tf.focus();
 };
 return <PlateElement {...p} as="span"><span contentEditable={false}>/<input
  {...inputProps} ref={input} value={query} aria-label="搜索插入指令" aria-controls={optionsId}
  onChange={e=>{setQuery(e.target.value);setActive(0);}}
  onKeyDown={e=>{
   if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(i=>options.length?(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length:0);}
   else if(e.key==='Enter'&&options[active]){e.preventDefault();run(options[active].kind);}
   else inputProps.onKeyDown(e);
  }}/><span className="slash" role="listbox" id={optionsId} aria-label="插入内容">
  {options.map((item,i)=><button key={item.kind} type="button" role="option" aria-selected={i===active}
   onMouseDown={e=>e.preventDefault()} onClick={()=>run(item.kind)}>{item.label}</button>)}
  {!options.length&&<span>没有匹配的指令</span>}
 </span></span>{p.children}</PlateElement>;
}

export const editorPlugins=[ParagraphPlugin.withComponent(P),H1Plugin.withComponent(H1),H2Plugin.withComponent(H2),
 H3Plugin.withComponent(H3),BlockquotePlugin.withComponent(Quote),BoldPlugin.withComponent(Bold),
 ItalicPlugin.withComponent(Italic),UnderlinePlugin.withComponent(Underline),StrikethroughPlugin.withComponent(Strike),
 FontFamilyPlugin,FontSizePlugin,TextAlignPlugin.configure({inject:{nodeProps:{nodeKey:'align',styleKey:'textAlign',validNodeValues:['left','center','right','justify']},targetPlugins:['p','h1','h2','h3']}}),
 LineHeightPlugin,IndentPlugin,ListPlugin,TablePlugin.withComponent(Table),TableRowPlugin.withComponent(Tr),
 TableCellPlugin.withComponent(Td),TableCellHeaderPlugin.withComponent(Th),LinkPlugin.withComponent(Link),
 ImagePlugin.withComponent(Image),SlashPlugin,SlashInputPlugin.withComponent(Slash),
 createPlatePlugin({key:'writing_binding',node:{isLeaf:true,component:Bound}})];

export function WritingEditor({content,onChange,onSelect,onFact,readOnly=false}:{content:Node[];onChange:(value:Node[])=>void;onSelect:(id:string)=>void;onFact:(key:string)=>void;readOnly?:boolean}){
 const editor=usePlateEditor({plugins:editorPlugins,nodeId:{idCreator:newId,initialValueIds:'always'},
  value:(content.length?content:[{id:newId(),type:'p',children:[{text:''}]}]) as Value},[]);
 const lastAccepted=useRef<Node[]>(structuredClone(editor.children as Node[]));
 const restoring=useRef(false);
 const [guardMessage,setGuardMessage]=useState('');
 const action=(fn:()=>void)=>{fn();editor.tf.focus();};
 const selectBlock=()=>{const i=editor.selection?.anchor.path[0];if(i!==undefined)onSelect(String(editor.children[i]?.id??''));};
 return <SourceContext.Provider value={onFact}><div className="toolbar" role="toolbar" aria-label="Plate 编辑工具">
  <button disabled={readOnly} onMouseDown={e=>e.preventDefault()} onClick={()=>action(()=>editor.tf.undo())}>撤销</button>
  <button disabled={readOnly} onMouseDown={e=>e.preventDefault()} onClick={()=>action(()=>editor.tf.redo())}>重做</button>
  <select aria-label="段落样式" disabled={readOnly} onChange={e=>action(()=>editor.tf.setNodes({type:e.target.value}))}>
   {[['正文','p'],['一级标题','h1'],['二级标题','h2'],['三级标题','h3']].map(([label,type])=><option key={type} value={type}>{label}</option>)}</select>
  {[['粗体',KEYS.bold],['斜体',KEYS.italic],['下划线',KEYS.underline]].map(([label,key])=><button key={key} disabled={readOnly} onMouseDown={e=>e.preventDefault()} onClick={()=>action(()=>editor.tf.toggleMark(key))}>{label}</button>)}
  <select aria-label="字号" disabled={readOnly} defaultValue="16px" onChange={e=>editor.tf.addMark('fontSize',e.target.value)}>{[12,14,16,18,22,26].map(n=><option key={n} value={`${n}px`}>{n}</option>)}</select>
  <select aria-label="对齐" disabled={readOnly} onChange={e=>action(()=>editor.tf.setNodes({align:e.target.value}))}>{[['左对齐','left'],['居中','center'],['右对齐','right'],['两端对齐','justify']].map(([label,key])=><option key={key} value={key}>{label}</option>)}</select>
  <button disabled={readOnly} onMouseDown={e=>e.preventDefault()} onClick={()=>action(()=>editor.getTransforms(TablePlugin).insert.table({rowCount:3,colCount:3},{select:true}))}>表格</button>
 </div>{guardMessage&&<div className="status" role="alert">{guardMessage}</div>}
 <div className="body"><Plate editor={editor} onChange={({value})=>{
  if(restoring.current){restoring.current=false;return;}
  const next=value as Node[],issue=controlledEditIssue(lastAccepted.current,next);
  if(issue){setGuardMessage(issue.message);restoring.current=true;editor.tf.setValue(structuredClone(lastAccepted.current) as Value);return;}
  // IDs are created inside Plate state, not reminted on each emitted change.
  lastAccepted.current=structuredClone(next);setGuardMessage('');onChange(next);
 }}><PlateContent className="paper" readOnly={readOnly} placeholder="开始写作，输入 / 插入标题或表格" onMouseUp={selectBlock} onKeyUp={selectBlock}/></Plate></div>
 </SourceContext.Provider>;
}
