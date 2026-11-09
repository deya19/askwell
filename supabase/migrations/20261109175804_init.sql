-- Askwell initial schema: the 7 tables from project.md §7, RLS, grants and the RLS helpers.
--
-- Access model (project.md §7, §9):
--   anon           nothing
--   authenticated  SELECT rows in their own projects (and their own accounts row),
--                  UPDATE projects.name, DELETE their own projects
--   service_role   SELECT/INSERT/UPDATE/DELETE on every table (bypasses RLS); used only on the server
-- TRUNCATE is never granted to an API role.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.accounts (
  clerk_user_id text primary key,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.accounts (clerk_user_id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  public_key text not null unique check (public_key ~ '^pk_[A-Za-z0-9_-]{16,128}$'),
  messages_used integer not null default 0 check (messages_used >= 0),
  period_start timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index projects_owner_id_idx on public.projects (owner_id);

create table public.widget_configs (
  project_id uuid primary key references public.projects (id) on delete cascade,
  button_color text not null check (button_color ~ '^#[0-9a-fA-F]{6}$'),
  position text not null check (position in ('bottom-right', 'bottom-left', 'top-right', 'top-left')),
  label text not null check (char_length(btrim(label)) between 1 and 40),
  animation text not null check (animation in ('fade', 'slide', 'scale')),
  header_text text not null check (char_length(btrim(header_text)) between 1 and 80),
  show_badge boolean not null
);

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  type text not null check (type in ('text', 'pdf', 'md', 'txt')),
  storage_key text,
  status text not null check (status in ('uploading', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  -- Pasted text has no file; every file source has one.
  constraint knowledge_sources_storage_key_matches_type check ((type = 'text') = (storage_key is null)),
  -- Lets knowledge_chunks prove its project matches its source's project.
  constraint knowledge_sources_id_project_id_key unique (id, project_id)
);

create index knowledge_sources_project_id_created_at_idx on public.knowledge_sources (project_id, created_at);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id uuid not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  -- Deleted with its source, and always in the same project as its source.
  constraint knowledge_chunks_source_fkey foreign key (source_id, project_id)
    references public.knowledge_sources (id, project_id) on delete cascade
);

create index knowledge_chunks_source_id_idx on public.knowledge_chunks (source_id);
create index knowledge_chunks_project_id_idx on public.knowledge_chunks (project_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id text not null check (char_length(visitor_id) between 1 and 100),
  created_at timestamptz not null default now()
);

create index conversations_project_id_created_at_idx on public.conversations (project_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('visitor', 'bot')),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS helpers (SECURITY DEFINER, in a schema the Data API doesn't expose)
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;

-- The caller's projects, by the Clerk user ID in their token.
create function private.owned_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.projects p
  where p.owner_id = (select auth.jwt() ->> 'sub');
$$;

-- Conversations in the caller's projects.
create function private.owned_conversation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.conversations c
  where c.project_id in (select private.owned_project_ids());
$$;

revoke all on function private.owned_project_ids() from public, anon, authenticated, service_role;
revoke all on function private.owned_conversation_ids() from public, anon, authenticated, service_role;

-- Policies run as the caller, so `authenticated` needs to reach and run the helpers.
grant usage on schema private to authenticated;
grant execute on function private.owned_project_ids() to authenticated;
grant execute on function private.owned_conversation_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.projects enable row level security;
alter table public.widget_configs enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "Owners read their own account"
  on public.accounts for select to authenticated
  using (clerk_user_id = (select auth.jwt() ->> 'sub'));

create policy "Owners read their own projects"
  on public.projects for select to authenticated
  using (owner_id = (select auth.jwt() ->> 'sub'));

create policy "Owners rename their own projects"
  on public.projects for update to authenticated
  using (owner_id = (select auth.jwt() ->> 'sub'))
  with check (owner_id = (select auth.jwt() ->> 'sub'));

create policy "Owners delete their own projects"
  on public.projects for delete to authenticated
  using (owner_id = (select auth.jwt() ->> 'sub'));

create policy "Owners read their projects' widget configs"
  on public.widget_configs for select to authenticated
  using (project_id in (select private.owned_project_ids()));

create policy "Owners read their projects' knowledge sources"
  on public.knowledge_sources for select to authenticated
  using (project_id in (select private.owned_project_ids()));

create policy "Owners read their projects' knowledge chunks"
  on public.knowledge_chunks for select to authenticated
  using (project_id in (select private.owned_project_ids()));

create policy "Owners read their projects' conversations"
  on public.conversations for select to authenticated
  using (project_id in (select private.owned_project_ids()));

create policy "Owners read their projects' messages"
  on public.messages for select to authenticated
  using (conversation_id in (select private.owned_conversation_ids()));

-- ---------------------------------------------------------------------------
-- Grants (explicit; overrides Supabase's default grants on new tables)
-- ---------------------------------------------------------------------------

revoke all on table
  public.accounts, public.projects, public.widget_configs, public.knowledge_sources,
  public.knowledge_chunks, public.conversations, public.messages
from public, anon, authenticated, service_role;

grant select on table
  public.accounts, public.projects, public.widget_configs, public.knowledge_sources,
  public.knowledge_chunks, public.conversations, public.messages
to authenticated;
grant update (name) on table public.projects to authenticated;
grant delete on table public.projects to authenticated;

grant select, insert, update, delete on table
  public.accounts, public.projects, public.widget_configs, public.knowledge_sources,
  public.knowledge_chunks, public.conversations, public.messages
to service_role;
