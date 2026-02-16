-- Shindig v1.0 MVP Database Schema

-- Users table (mirrors auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Events table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  location text,
  maps_url text,
  cover_image_url text,
  start_time timestamptz not null,
  end_time timestamptz,
  timezone text not null default 'America/New_York',
  slug text not null unique,
  is_public boolean not null default true,
  allow_plus_ones boolean not null default true,
  gift_registry_url text,
  gift_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Anyone can read public events"
  on public.events for select
  using (is_public = true);

create policy "Hosts can read own events"
  on public.events for select
  using (auth.uid() = host_id);

create policy "Hosts can create events"
  on public.events for insert
  with check (auth.uid() = host_id);

create policy "Hosts can update own events"
  on public.events for update
  using (auth.uid() = host_id);

create policy "Hosts can delete own events"
  on public.events for delete
  using (auth.uid() = host_id);

create index idx_events_slug on public.events(slug);
create index idx_events_host_id on public.events(host_id);

-- Guests table
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'going', 'maybe', 'declined')),
  plus_one_count integer not null default 0,
  dietary text,
  message text,
  rsvp_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  invited_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.guests enable row level security;

create policy "Hosts can manage guests of own events"
  on public.guests for all
  using (
    exists (
      select 1 from public.events
      where events.id = guests.event_id
      and events.host_id = auth.uid()
    )
  );

create index idx_guests_event_id on public.guests(event_id);
create index idx_guests_rsvp_token on public.guests(rsvp_token);

-- Feature requests table
create table public.feature_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  author_name text not null default 'Anonymous',
  author_email text,
  status text not null default 'open' check (status in ('open', 'planned', 'in_progress', 'done')),
  vote_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.feature_requests enable row level security;

create policy "Anyone can read feature requests"
  on public.feature_requests for select
  using (true);

create policy "Anyone can create feature requests"
  on public.feature_requests for insert
  with check (true);

-- Feature votes table
create table public.feature_votes (
  id uuid primary key default gen_random_uuid(),
  feature_id uuid not null references public.feature_requests(id) on delete cascade,
  voter_identifier text not null,
  created_at timestamptz not null default now(),
  unique(feature_id, voter_identifier)
);

alter table public.feature_votes enable row level security;

create policy "Anyone can read votes"
  on public.feature_votes for select
  using (true);

create policy "Anyone can vote"
  on public.feature_votes for insert
  with check (true);

create policy "Anyone can remove own vote"
  on public.feature_votes for delete
  using (true);

-- Trigger to maintain vote_count on feature_requests
create or replace function public.update_vote_count()
returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update public.feature_requests
    set vote_count = vote_count + 1
    where id = NEW.feature_id;
    return NEW;
  elsif (TG_OP = 'DELETE') then
    update public.feature_requests
    set vote_count = vote_count - 1
    where id = OLD.feature_id;
    return OLD;
  end if;
  return null;
end;
$$ language plpgsql security definer;

create trigger on_vote_change
  after insert or delete on public.feature_votes
  for each row execute function public.update_vote_count();
