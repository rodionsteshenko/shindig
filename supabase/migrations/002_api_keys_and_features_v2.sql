-- Shindig v2.0 — API keys and feature board enhancements
-- Run this in the Supabase SQL Editor after applying 001_initial_schema.sql

-- API keys table
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default '{"events:read","events:write","guests:read","guests:write","features:read"}',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;

create policy "Users can manage own API keys"
  on public.api_keys for all
  using (auth.uid() = user_id);

create index idx_api_keys_user_id on public.api_keys(user_id);
create index idx_api_keys_key_hash on public.api_keys(key_hash);

-- Extend feature_requests with new columns
alter table public.feature_requests
  add column if not exists type text not null default 'feature' check (type in ('feature', 'bug')),
  add column if not exists ai_verdict text check (ai_verdict in ('approved', 'rejected', 'needs_clarification')),
  add column if not exists ai_reason text,
  add column if not exists severity text check (severity in ('critical', 'high', 'medium', 'low')),
  add column if not exists prd_json jsonb,
  add column if not exists implementation_status text not null default 'none'
    check (implementation_status in ('none', 'queued', 'in_progress', 'completed', 'failed'));

-- Extend status constraint to include new values
-- Drop old constraint and add new one
alter table public.feature_requests
  drop constraint if exists feature_requests_status_check;

alter table public.feature_requests
  add constraint feature_requests_status_check
    check (status in ('open', 'approved', 'rejected', 'needs_clarification', 'planned', 'in_progress', 'done'));

-- Allow service role to update feature_requests (for judge script)
create policy "Service role can update feature requests"
  on public.feature_requests for update
  using (true)
  with check (true);
