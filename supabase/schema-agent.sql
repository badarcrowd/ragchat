-- Crowd Agent schema additions
-- Run this after the base schema.sql

-- Extended lead sessions for the agentic flow
create table if not exists lead_agent_sessions (
  id uuid primary key,
  tenant_id text not null default 'default',
  form_data jsonb not null default '{}'::jsonb,
  audit_result jsonb,
  lead_score integer,
  lead_tier text check (lead_tier in ('hot', 'warm', 'cold')),
  booking_slot_id text,
  crm_synced_at timestamptz,
  monday_item_id text,
  phase text not null default 'greeting'
    check (phase in ('greeting', 'discovery', 'audit', 'qualification', 'booking', 'booked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lead_agent_sessions_tenant_idx
  on lead_agent_sessions (tenant_id, updated_at desc);

-- Case studies for vector search (populate via admin ingest)
-- Uses the existing documents + chunks tables.
-- Tag case study documents with metadata->>'type' = 'case_study'

-- Agent events log
create table if not exists agent_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references lead_agent_sessions(id) on delete set null,
  tenant_id text not null default 'default',
  event_type text not null,  -- 'audit', 'case_study_search', 'budget_validated', 'crm_synced', 'meeting_booked'
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_events_session_idx
  on agent_events (session_id, created_at desc);

-- Meeting bookings
create table if not exists meeting_bookings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references lead_agent_sessions(id) on delete set null,
  tenant_id text not null default 'default',
  lead_id uuid references leads(id) on delete set null,
  name text not null,
  email text not null,
  slot_iso text not null,          -- ISO datetime of the booked slot
  display_date text not null,
  display_time text not null,
  notes text,
  google_event_id text,            -- Google Calendar event ID if created
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists meeting_bookings_tenant_idx
  on meeting_bookings (tenant_id, created_at desc);
create index if not exists meeting_bookings_email_idx
  on meeting_bookings (lower(email));

-- RLS: All tables default to service-role access only
-- (same policy as the rest of the schema)
