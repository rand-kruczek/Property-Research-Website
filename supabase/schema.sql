-- Reference schema for the public collaborative tracker.
-- The publishable key is safe to expose; RLS intentionally allows anonymous collaboration.
create table if not exists public.properties (
  id text primary key,
  data jsonb not null,
  version integer not null default 1 check (version > 0),
  merged_into text
);
create index if not exists properties_merged_into_idx on public.properties(merged_into);

create table if not exists public.audit (
  id text primary key,
  property_id text not null,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  before jsonb,
  after jsonb
);
create index if not exists audit_property_idx on public.audit(property_id,at desc);

create table if not exists public.settings (key text primary key,value jsonb not null);

alter table public.properties enable row level security;
alter table public.audit enable row level security;
alter table public.settings enable row level security;
grant usage on schema public to anon,authenticated;
grant select,insert,update,delete on public.properties to anon,authenticated;
grant select,insert on public.audit to anon,authenticated;
grant select,insert,update on public.settings to anon,authenticated;

create policy "public properties read" on public.properties for select to anon,authenticated using (true);
create policy "public properties insert" on public.properties for insert to anon,authenticated with check (true);
create policy "public properties update" on public.properties for update to anon,authenticated using (true) with check (true);
create policy "public properties delete" on public.properties for delete to anon,authenticated using (true);
create policy "public audit read" on public.audit for select to anon,authenticated using (true);
create policy "public audit insert" on public.audit for insert to anon,authenticated with check (true);
create policy "public settings read" on public.settings for select to anon,authenticated using (true);
create policy "public settings insert" on public.settings for insert to anon,authenticated with check (true);
create policy "public settings update" on public.settings for update to anon,authenticated using (true) with check (true);

create or replace function public.tracker_save(p_id text,p_data jsonb,p_expected_version integer,p_actor text,p_action text,p_before jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare next_version integer;
begin
  if p_expected_version is null then
    insert into public.properties(id,data,version,merged_into) values(p_id,p_data,1,null);
    next_version:=1;
  else
    update public.properties set data=p_data,version=version+1 where id=p_id and version=p_expected_version and merged_into is null returning version into next_version;
    if next_version is null then raise exception 'concurrent_edit'; end if;
  end if;
  insert into public.audit(id,property_id,at,actor,action,before,after) values(gen_random_uuid()::text,p_id,now(),p_actor,p_action,p_before,p_data);
  return p_data||jsonb_build_object('version',next_version);
end; $$;

create or replace function public.tracker_merge(p_target text,p_source text,p_target_version integer,p_source_version integer,p_data jsonb,p_actor text,p_before jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare changed integer;
begin
  update public.properties set data=p_data,version=version+1 where id=p_target and version=p_target_version and merged_into is null;
  get diagnostics changed=row_count; if changed<>1 then raise exception 'concurrent_edit'; end if;
  update public.properties set merged_into=p_target,version=version+1 where id=p_source and version=p_source_version and merged_into is null;
  get diagnostics changed=row_count; if changed<>1 then raise exception 'concurrent_edit'; end if;
  insert into public.audit(id,property_id,at,actor,action,before,after) values
    (gen_random_uuid()::text,p_target,now(),p_actor,'Merge (complete originals retained)',p_before,p_data),
    (gen_random_uuid()::text,p_source,now(),p_actor,'Merged into '||p_target,p_before,p_data);
  return p_data||jsonb_build_object('version',p_target_version+1);
end; $$;

create or replace function public.tracker_import(p_records jsonb,p_actor text)
returns integer language plpgsql security invoker set search_path=public as $$
declare rec jsonb; imported integer:=0;
begin
  for rec in select value from jsonb_array_elements(p_records) loop
    insert into public.properties(id,data,version,merged_into) values(rec->>'id',rec,coalesce((rec->>'version')::integer,1),null);
    insert into public.audit(id,property_id,at,actor,action,before,after) values(gen_random_uuid()::text,rec->>'id',now(),p_actor,'CSV import',null,rec);
    imported:=imported+1;
  end loop;
  return imported;
end; $$;

create or replace function public.tracker_settings(p_expected_version integer,p_next jsonb,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_value jsonb;
begin
  select value into current_value from public.settings where key='tab-settings' for update;
  if coalesce((current_value->>'version')::integer,0)<>p_expected_version then raise exception 'concurrent_edit'; end if;
  insert into public.settings(key,value) values('tab-settings',p_next) on conflict(key) do update set value=excluded.value;
  insert into public.audit(id,property_id,at,actor,action,before,after) values(gen_random_uuid()::text,'__tab-settings__',now(),p_actor,'Update tab names and pin colors',current_value,p_next);
  return p_next;
end; $$;

revoke all on function public.tracker_save(text,jsonb,integer,text,text,jsonb) from public;
revoke all on function public.tracker_merge(text,text,integer,integer,jsonb,text,jsonb) from public;
revoke all on function public.tracker_import(jsonb,text) from public;
revoke all on function public.tracker_settings(integer,jsonb,text) from public;
grant execute on function public.tracker_save(text,jsonb,integer,text,text,jsonb) to anon,authenticated;
grant execute on function public.tracker_merge(text,text,integer,integer,jsonb,text,jsonb) to anon,authenticated;
grant execute on function public.tracker_import(jsonb,text) to anon,authenticated;
grant execute on function public.tracker_settings(integer,jsonb,text) to anon,authenticated;