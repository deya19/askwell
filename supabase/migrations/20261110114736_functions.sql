-- Askwell data functions (project.md §6.3, §6.4, §6.6, §6.12, §7).
--
-- Every function is SECURITY INVOKER with `search_path = ''`.
--   service_role   create_project, reserve_knowledge_source, consume_message, save_chat_turn, match_chunks
--   authenticated  owner_activity only (runs as the caller, so RLS scopes it to their projects)
--   anon           nothing
--
-- Plan limits are never hardcoded here: callers pass them from PLAN_LIMITS in packages/shared.
-- The three functions that count check and write under a row lock, so two concurrent calls
-- can't both take the last slot.
--
-- Errors callers can act on (codes mirrored in packages/db/src/errors.ts):
--   AWL01  project_limit_reached     create_project
--   AWL02  source_limit_reached      reserve_knowledge_source
--   P0002  account_not_found / project_not_found / conversation_not_found

-- ---------------------------------------------------------------------------
-- Usage period
-- ---------------------------------------------------------------------------

-- The start of the monthly usage period that contains `as_of`. Periods are whole months
-- counted from the stored `period_start`, so a project created on the 10th resets on the 10th.
create function private.current_period_start(period_start timestamptz, as_of timestamptz default now())
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select current_period_start.period_start + pg_catalog.make_interval(months => greatest(0, (
    extract(year from pg_catalog.age(current_period_start.as_of, current_period_start.period_start)) * 12
    + extract(month from pg_catalog.age(current_period_start.as_of, current_period_start.period_start))
  )::integer));
$$;

-- ---------------------------------------------------------------------------
-- create_project (§6.3)
-- ---------------------------------------------------------------------------

-- Creates a project with a random public key and its default widget config, unless the owner
-- already has `max_projects`. The owner's account row is locked, so concurrent creates for
-- one owner run one at a time. Widget defaults match DEFAULT_WIDGET_CONFIG in packages/shared.
create function public.create_project(owner_id text, name text, max_projects integer)
returns public.projects
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  project public.projects;
begin
  perform 1 from public.accounts a where a.clerk_user_id = create_project.owner_id for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  -- A missing limit refuses rather than allowing everything.
  if create_project.max_projects is null
    or (select count(*) from public.projects p where p.owner_id = create_project.owner_id) >= create_project.max_projects then
    raise exception 'project_limit_reached' using errcode = 'AWL01';
  end if;

  insert into public.projects (owner_id, name, public_key)
  values (
    create_project.owner_id,
    pg_catalog.btrim(create_project.name),
    -- 64 hex characters (244 random bits) from two UUIDv4s.
    'pk_' || pg_catalog.replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
  )
  returning * into project;

  insert into public.widget_configs (project_id, button_color, position, label, animation, header_text, show_badge)
  values (project.id, '#0a0a0a', 'bottom-right', 'Ask a question', 'fade', 'How can we help?', false);

  return project;
end;
$$;

-- ---------------------------------------------------------------------------
-- reserve_knowledge_source (§6.4)
-- ---------------------------------------------------------------------------

-- Adds a knowledge source unless the project already has `max_sources` (files and pasted
-- texts count alike, whatever their status). A file starts as `uploading` (finalize moves it
-- on); pasted text starts as `processing` and has no `storage_key`. The project row is locked
-- while counting.
create function public.reserve_knowledge_source(
  project_id uuid,
  title text,
  type text,
  max_sources integer,
  storage_key text default null
)
returns public.knowledge_sources
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  source public.knowledge_sources;
begin
  perform 1 from public.projects p where p.id = reserve_knowledge_source.project_id for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  if reserve_knowledge_source.max_sources is null or (
    select count(*) from public.knowledge_sources s where s.project_id = reserve_knowledge_source.project_id
  ) >= reserve_knowledge_source.max_sources then
    raise exception 'source_limit_reached' using errcode = 'AWL02';
  end if;

  insert into public.knowledge_sources (project_id, title, type, storage_key, status)
  values (
    reserve_knowledge_source.project_id,
    pg_catalog.btrim(reserve_knowledge_source.title),
    reserve_knowledge_source.type,
    reserve_knowledge_source.storage_key,
    case when reserve_knowledge_source.type = 'text' then 'processing' else 'uploading' end
  )
  returning * into source;

  return source;
end;
$$;

-- ---------------------------------------------------------------------------
-- consume_message (§6.6 step 3, §6.12)
-- ---------------------------------------------------------------------------

-- Counts one chat message against the project's monthly quota. Starts a new period (and
-- resets the count) once the stored one is over a month old. Returns true if the message is
-- allowed, false at the limit (nothing is written then). The project row is locked.
create function public.consume_message(project_id uuid, max_messages integer)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  stored_start timestamptz;
  period timestamptz;
  used integer;
begin
  select p.period_start, p.messages_used into stored_start, used
  from public.projects p
  where p.id = consume_message.project_id
  for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  period := private.current_period_start(stored_start);
  if period > stored_start then
    used := 0;
  end if;

  if consume_message.max_messages is null or used >= consume_message.max_messages then
    return false;
  end if;

  update public.projects p
  set messages_used = used + 1, period_start = period
  where p.id = consume_message.project_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- save_chat_turn (§6.6 step 6)
-- ---------------------------------------------------------------------------

-- Saves one visitor message and the bot's reply. Creates the conversation when
-- `conversation_id` is null or left out; otherwise it must belong to the project. Returns the
-- conversation ID. The reply is stamped after the question, so they always sort in order.
create function public.save_chat_turn(
  project_id uuid,
  visitor_id text,
  visitor_message text,
  bot_reply text,
  conversation_id uuid default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  conversation uuid := save_chat_turn.conversation_id;
begin
  if conversation is null then
    insert into public.conversations (project_id, visitor_id)
    values (save_chat_turn.project_id, save_chat_turn.visitor_id)
    returning id into conversation;
  elsif not exists (
    select 1 from public.conversations c
    where c.id = conversation and c.project_id = save_chat_turn.project_id
  ) then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;

  insert into public.messages (conversation_id, role, body, created_at)
  values (conversation, 'visitor', save_chat_turn.visitor_message, pg_catalog.clock_timestamp());
  insert into public.messages (conversation_id, role, body, created_at)
  values (conversation, 'bot', save_chat_turn.bot_reply, pg_catalog.clock_timestamp());

  return conversation;
end;
$$;

-- ---------------------------------------------------------------------------
-- match_chunks (§6.6 step 4)
-- ---------------------------------------------------------------------------

-- The `match_count` chunks nearest to `query_embedding` by cosine distance, from `ready`
-- sources in one project only. `similarity` is 1 - cosine distance.
create function public.match_chunks(project_id uuid, query_embedding extensions.vector(1536), match_count integer)
returns table (id uuid, source_id uuid, content text, similarity double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.source_id,
    c.content,
    1 - (c.embedding operator(extensions.<=>) match_chunks.query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_sources s on s.id = c.source_id and s.project_id = c.project_id
  where c.project_id = match_chunks.project_id
    and s.status = 'ready'
  order by c.embedding operator(extensions.<=>) match_chunks.query_embedding
  limit greatest(match_chunks.match_count, 0); -- null counts as 0
$$;

-- ---------------------------------------------------------------------------
-- owner_activity (§6.12)
-- ---------------------------------------------------------------------------

-- The usage numbers for the caller's projects: messages used in the current period and when
-- that period started. A period that has rolled over shows 0, even before the next message
-- resets the stored count. Runs as the caller, so RLS limits it to their own projects.
create function public.owner_activity()
returns table (project_id uuid, messages_used integer, period_start timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    case when u.period > p.period_start then 0 else p.messages_used end,
    u.period
  from public.projects p
  cross join lateral (select private.current_period_start(p.period_start) as period) u
  order by p.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function private.current_period_start(timestamptz, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.create_project(text, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.reserve_knowledge_source(uuid, text, text, integer, text) from public, anon, authenticated, service_role;
revoke all on function public.consume_message(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.save_chat_turn(uuid, text, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.match_chunks(uuid, extensions.vector, integer) from public, anon, authenticated, service_role;
revoke all on function public.owner_activity() from public, anon, authenticated, service_role;

grant execute on function public.create_project(text, text, integer) to service_role;
grant execute on function public.reserve_knowledge_source(uuid, text, text, integer, text) to service_role;
grant execute on function public.consume_message(uuid, integer) to service_role;
grant execute on function public.save_chat_turn(uuid, text, text, text, uuid) to service_role;
grant execute on function public.match_chunks(uuid, extensions.vector, integer) to service_role;
grant execute on function public.owner_activity() to authenticated;

-- consume_message and owner_activity read the period through the private helper.
grant usage on schema private to service_role;
grant execute on function private.current_period_start(timestamptz, timestamptz) to service_role, authenticated;
