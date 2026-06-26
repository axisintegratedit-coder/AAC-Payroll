-- Supabase schema for the AAC/Axis payroll deployment (JSONB mirror of Firestore).
-- Run in the Supabase SQL editor. Mirrors /organizations/{org_id}/... document tree.

-- single-object settings docs  (Firestore: organizations/{oid}/settings/{key})
create table if not exists config (
  org_id text not null,
  key    text not null,
  data   jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

-- { items: T[] } single-doc arrays  (Firestore: organizations/{oid}/data/{key})
create table if not exists data_arrays (
  org_id text not null,
  key    text not null,
  data   jsonb not null,   -- the array itself, stored as a JSON array
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);

-- one row per collection item  (Firestore: organizations/{oid}/{collection}/{id})
create table if not exists collections (
  org_id     text not null,
  collection text not null,
  id         text not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (org_id, collection, id)
);

create index if not exists collections_lookup
  on collections (org_id, collection, created_at desc);

-- RLS: start permissive (any authenticated user). Tighten to org membership before production.
alter table config       enable row level security;
alter table data_arrays  enable row level security;
alter table collections  enable row level security;

create policy "authenticated full access" on config
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on data_arrays
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on collections
  for all to authenticated using (true) with check (true);
