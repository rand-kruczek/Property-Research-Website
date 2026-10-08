import {clean,duplicate,Property} from '@/lib/properties';
import {defaultTabSettings,validateTabSettings} from '@/lib/tab-settings';
import seeds from '@/data/seed.json';

export const dynamic='force-dynamic';

const SUPABASE_URL=process.env.SUPABASE_URL||'https://kzkpsexzcivxgqhrlubl.supabase.co';
const SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_MTqS-euOWdB08RU4VmoZSA_j7tO3ng2';

function fail(error:any){
  console.error(error);
  const raw=String(error?.message||error||'Unable to complete request.');
  const concurrent=raw.includes('concurrent_edit')||raw.includes('duplicate key');
  return Response.json({error:concurrent?'The database changed on another device. Refresh and try again.':raw},{status:concurrent?409:(error?.code||400)});
}

function authorize(request:Request){
  if(request.method!=='GET'&&request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin){
    throw Object.assign(Error('Invalid request origin.'),{code:403});
  }
  return request.headers.get('oai-authenticated-user-id')||'public-collaborator';
}

async function supabase(path:string,init:RequestInit={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    ...init,
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',...(init.headers||{})},
    cache:'no-store',
  });
  const text=await response.text();
  let data:any=null;
  if(text){try{data=JSON.parse(text)}catch{data=text}}
  if(!response.ok)throw Object.assign(Error(data?.message||data?.error||`Database request failed (${response.status}).`),{code:response.status});
  return data;
}

async function rpc(name:string,body:any){
  return supabase(`rpc/${name}`,{method:'POST',body:JSON.stringify(body)});
}

async function rows(){
  const all:any[]=[];
  const pageSize=1000;
  for(let offset=0;;offset+=pageSize){
    const page=await supabase(`properties?select=id,data,version&merged_into=is.null&order=id.asc&limit=${pageSize}&offset=${offset}`);
    all.push(...page);
    if(page.length<pageSize)break;
  }
  return all.map(row=>({...row.data,id:row.id,version:row.version}));
}

async function tabSettings(){
  const result=await supabase('settings?select=value&key=eq.tab-settings&limit=1');
  if(!result.length)return defaultTabSettings;
  const value=typeof result[0].value==='string'?JSON.parse(result[0].value):result[0].value;
  return validateTabSettings(value);
}

export async function GET(request:Request){
  try{
    authorize(request);
    const url=new URL(request.url);
    if(url.searchParams.has('settings'))return Response.json(await tabSettings(),{headers:{'Cache-Control':'no-store'}});
    const id=url.searchParams.get('history');
    if(id){
      const history=await supabase(`audit?select=*&property_id=eq.${encodeURIComponent(id)}&order=at.desc`);
      return Response.json(history,{headers:{'Cache-Control':'no-store'}});
    }
    return Response.json(await rows(),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return fail(error)}
}

export async function POST(request:Request){
  try{
    const actor=authorize(request);
    const text=await request.text();
    if(text.length>6000000)throw Error('Upload is too large.');
    const body=JSON.parse(text);

    if(body.action==='settings'){
      const before=await tabSettings();
      const next=validateTabSettings(body.settings);
      if(next.version!==before.version)throw Object.assign(Error('Settings changed on another device. Close settings, refresh properties, and try again.'),{code:409});
      const removed=before.statuses.filter(tab=>!next.statuses.some(candidate=>candidate.id===tab.id));
      if(removed.length){
        const existing=await rows();
        if(removed.some(tab=>existing.some(property=>property.status===tab.id)))throw Error('Move properties out of a custom tab before removing it.');
      }
      next.version++;
      return Response.json(await rpc('tracker_settings',{p_expected_version:before.version,p_next:next,p_actor:actor}));
    }

    if(body.action==='seed'){
      const existing=await rows();
      const fresh=(seeds as Property[])
        .map((property):Property=>({...property,originalResearchStatus:property.status,status:'Not Contacted'}))
        .filter(property=>!existing.some((candidate:Property)=>duplicate(property,candidate)))
        .map(property=>({...property,id:property.id||crypto.randomUUID(),version:1}));
      if(fresh.length)await rpc('tracker_import',{p_records:fresh,p_actor:actor});
      return Response.json({message:`Loaded ${fresh.length} sourced properties.`});
    }

    const existing=await rows();

    if(body.action==='merge'){
      const target=existing.find((property:Property)=>property.id===body.target);
      const source=existing.find((property:Property)=>property.id===body.source);
      if(!target||!source||target.id===source.id)throw Error('Select two different active records.');
      if(target.version!==body.targetVersion||source.version!==body.sourceVersion)throw Object.assign(Error('A record changed on another device. Reload before merging.'),{code:409});
      const merged:any={...target};
      for(const [key,value] of Object.entries(source))if(!merged[key]&&value)merged[key]=value;
      merged.notes=[target.notes,source.notes&&`Merged notes from ${source.name} (${source.id}):\n${source.notes}`].filter(Boolean).join('\n\n');
      merged.comments=[target.comments,source.comments&&`Merged comments: ${source.comments}`,`Merged ${source.id}. Original record, sources and all conflicting values are preserved in audit history.`].filter(Boolean).join('\n\n');
      merged.possibleDuplicate=false;
      merged.needsVerification=true;
      merged.version=target.version+1;
      return Response.json(await rpc('tracker_merge',{p_target:target.id,p_source:source.id,p_target_version:target.version,p_source_version:source.version,p_data:merged,p_actor:actor,p_before:{target,source}}));
    }

    if(body.action==='import'){
      if(!Array.isArray(body.records)||body.records.length>500)throw Error('Import up to 500 records per batch.');
      const allowedStatuses=(await tabSettings()).statuses.map(tab=>tab.id);
      const accepted:Property[]=[];
      const issues:any[]=[];
      for(let index=0;index<body.records.length;index++){
        try{
          const property=clean(body.records[index],allowedStatuses);
          const match=[...existing,...accepted].find(candidate=>duplicate(property,candidate));
          if(match){issues.push({row:index+2,name:property.name,reason:'Possible duplicate of '+match.name,id:match.id});continue}
          property.id=crypto.randomUUID();
          property.version=1;
          accepted.push(property);
        }catch(error:any){issues.push({row:index+2,reason:error.message})}
      }
      if(!body.commit)return Response.json({accepted:accepted.length,issues});
      if(accepted.length)await rpc('tracker_import',{p_records:accepted,p_actor:actor});
      return Response.json({accepted:accepted.length,issues});
    }

    const property=clean(body.record,(await tabSettings()).statuses.map(tab=>tab.id));
    const old=existing.find((candidate:Property)=>candidate.id===property.id);
    if(property.id&&!old)throw Error('This record has been merged or is no longer active. Refresh before editing.');
    if(old&&old.version!==body.record.version)throw Object.assign(Error('This property changed on another device. Close and reopen it before saving.'),{code:409});
    if(!old){
      const match=existing.find((candidate:Property)=>duplicate(property,candidate));
      if(match)throw Error('Possible duplicate: '+match.name+'. Open the existing record to review or merge.');
      property.id=crypto.randomUUID();
    }else{
      const match=existing.find((candidate:Property)=>candidate.id!==property.id&&duplicate(property,candidate));
      if(match)property.possibleDuplicate=true;
    }
    if((property.status!=='Not Contacted'&&(!old||property.status!==old.status))||(old&&['notes','owner','contactName','phone','email','website','sites','acreage','monthlyRent','yearBuilt','comments','followUp','forSaleStatus','forSalePrice','lastSaleDate','lastSalePrice'].some(key=>property[key]!==old[key])))property.lastResearched=new Date().toISOString();
    property.version=(old?.version||0)+1;
    return Response.json(await rpc('tracker_save',{p_id:property.id,p_data:property,p_expected_version:old?.version??null,p_actor:actor,p_action:old?'Edit':'Create',p_before:old||null}));
  }catch(error){return fail(error)}
}
