import {statuses,types} from './properties';
export type TabStyle={id:string;label:string;color:string};
export type TabSettings={version:number;statuses:TabStyle[];types:TabStyle[];pinColorBy:'status'|'type'};
export const defaultTabSettings:TabSettings={version:0,pinColorBy:'status',statuses:statuses.map((id,i)=>({id,label:id,color:['#64748b','#16804a','#2563eb','#d97706','#dc2626','#9333ea'][i]})),types:types.map((id,i)=>({id,label:id,color:['#157b80','#466eb0','#ad7136'][i]}))};
export function validateTabSettings(input:any):TabSettings{
  if(!input||!Number.isInteger(input.version)||input.version<0)throw Error('Reload settings before saving.');
  function group(value:any,ids:string[],allowCustom=false):TabStyle[]{
    if(!Array.isArray(value)||value.length<ids.length||value.length>(allowCustom?20:ids.length))throw Error(allowCustom?'Keep between 6 and 20 status tabs.':'Each property type tab must be included.');
    const seen=new Set<string>();
    const result=value.map(v=>{const id=v?.id;if(typeof id!=='string'||seen.has(id)||(!ids.includes(id)&&(!allowCustom||!/^custom-[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(id))))throw Error('Invalid tab identifier.');seen.add(id);const label=typeof v.label==='string'?v.label.trim():'';if(!label||label.length>48)throw Error('Tab names must contain 1–48 characters.');if(typeof v.color!=='string'||!/^#[0-9a-f]{6}$/i.test(v.color))throw Error('Choose a valid pin color.');return {id,label,color:v.color.toLowerCase()};});
    if(ids.some(id=>!seen.has(id)))throw Error('Built-in tabs must be included.');
    if(new Set(result.map(v=>v.label.toLowerCase())).size!==result.length)throw Error('Use a different name for each tab.');return result;
  }
  if(!['status','type'].includes(input.pinColorBy))throw Error('Choose how to color map pins.');
  return {version:input.version,pinColorBy:input.pinColorBy,statuses:group(input.statuses,statuses,true),types:group(input.types,types)};
}
export const statusLabel=(settings:TabSettings,id:string)=>settings.statuses.find(s=>s.id===id)?.label||id;
export const typeLabel=(settings:TabSettings,id:string)=>settings.types.find(s=>s.id===id)?.label||id;
export const statusColor=(settings:TabSettings,id:string)=>settings.statuses.find(s=>s.id===id)?.color||'#64748b';
export const pinColor=(settings:TabSettings,p:{status:string;type:string})=>(settings.pinColorBy==='status'?settings.statuses.find(s=>s.id===p.status):settings.types.find(s=>s.id===p.type))?.color||'#64748b';
