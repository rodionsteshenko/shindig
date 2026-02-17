-- Shindig — Custom Event Fields
-- Allows hosts to create custom fields for collecting additional information from guests

-- Event custom fields table
create table public.event_custom_fields (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  type text not null check (type in ('text', 'poll', 'signup')),
  label text not null,
  description text,
  required boolean not null default false,
  sort_order integer not null default 0,
  options jsonb,
  config jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.event_custom_fields enable row level security;

-- Hosts can manage their own event's fields
create policy "Hosts can manage own event fields"
  on public.event_custom_fields for all
  using (
    exists (
      select 1 from public.events
      where events.id = event_custom_fields.event_id
      and events.host_id = auth.uid()
    )
  );

-- Anyone can read fields for public events
create policy "Anyone can read fields for public events"
  on public.event_custom_fields for select
  using (
    exists (
      select 1 from public.events
      where events.id = event_custom_fields.event_id
      and events.is_public = true
    )
  );

-- Index for fast lookup by event
create index idx_event_custom_fields_event_id on public.event_custom_fields(event_id);

-- Custom field responses table
create table public.custom_field_responses (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.event_custom_fields(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_field_responses enable row level security;

-- Unique constraint on (field_id, guest_id) - one response per field per guest
alter table public.custom_field_responses
  add constraint custom_field_responses_field_guest_unique unique (field_id, guest_id);

-- Indexes for fast lookup
create index idx_custom_field_responses_field_id on public.custom_field_responses(field_id);
create index idx_custom_field_responses_guest_id on public.custom_field_responses(guest_id);

-- Hosts can read responses for their event's fields
create policy "Hosts can read responses for own event fields"
  on public.custom_field_responses for select
  using (
    exists (
      select 1 from public.event_custom_fields ecf
      join public.events e on e.id = ecf.event_id
      where ecf.id = custom_field_responses.field_id
      and e.host_id = auth.uid()
    )
  );

-- Allow service role to manage responses (for RSVP flow via admin client)
-- Response writes go through admin/service role client since guests don't have auth accounts
create policy "Service role can manage responses"
  on public.custom_field_responses for all
  using (true)
  with check (true);
