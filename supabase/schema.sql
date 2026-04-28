create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'default',
  title text,
  source_url text,
  type text not null check (type in ('url', 'pdf', 'text')),
  status text not null default 'queued' check (status in ('queued', 'indexed', 'failed')),
  raw_text text,
  content_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  indexed_at timestamptz
);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  tenant_id text not null default 'default',
  content text not null,
  token_count integer not null,
  position integer not null,
  source_url text,
  title text,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key,
  tenant_id text not null default 'default',
  domain text,
  language text,
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete set null,
  tenant_id text not null default 'default',
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  language text,
  sources jsonb not null default '[]'::jsonb,
  response_time_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete set null,
  tenant_id text not null default 'default',
  name text not null,
  email text not null,
  phone text,
  status text not null default 'new',
  hubspot_contact_id text,
  hubspot_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  tenant_id text primary key,
  system_prompt text not null,
  allowed_domains text[] not null default '{}'::text[],
  lead_capture_after_messages integer not null default 3,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rate_limits (
  identifier text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

create index if not exists documents_tenant_created_idx on documents (tenant_id, created_at desc);
create index if not exists chunks_tenant_document_idx on chunks (tenant_id, document_id);
create index if not exists chunks_embedding_hnsw_idx on chunks using hnsw (embedding vector_cosine_ops);
create index if not exists messages_tenant_created_idx on messages (tenant_id, created_at desc);
create index if not exists messages_role_created_idx on messages (role, created_at desc);
create index if not exists sessions_tenant_last_seen_idx on sessions (tenant_id, last_seen_at desc);
create index if not exists leads_tenant_created_idx on leads (tenant_id, created_at desc);
create unique index if not exists leads_tenant_email_idx on leads (tenant_id, lower(email));

create or replace function match_chunks(
  query_embedding vector(1536),
  match_count integer default 5,
  tenant_filter text default 'default',
  min_similarity double precision default 0.2
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  source_url text,
  title text,
  similarity double precision
)
language sql
stable
as $$
  select
    chunks.id,
    chunks.document_id,
    chunks.content,
    chunks.source_url,
    chunks.title,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where chunks.tenant_id = tenant_filter
    and 1 - (chunks.embedding <=> query_embedding) >= min_similarity
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function consume_rate_limit(
  identifier text,
  window_seconds integer,
  max_requests integer
)
returns boolean
language plpgsql
as $$
declare
  current_count integer;
  current_window timestamptz;
begin
  insert into rate_limits(identifier, count, window_start)
  values (identifier, 1, now())
  on conflict (identifier) do update
  set
    count = case
      when rate_limits.window_start < now() - make_interval(secs => window_seconds)
      then 1
      else rate_limits.count + 1
    end,
    window_start = case
      when rate_limits.window_start < now() - make_interval(secs => window_seconds)
      then now()
      else rate_limits.window_start
    end
  returning count, window_start into current_count, current_window;

  return current_count <= max_requests;
end;
$$;

insert into settings (tenant_id, system_prompt, lead_capture_after_messages)
values (
  'default',
  'You are a concise, accurate support assistant. Answer only from the supplied context. If the answer is not in the retrieved context, say you do not know and offer to connect the user with a human.',
  3
)
on conflict (tenant_id) do nothing;
