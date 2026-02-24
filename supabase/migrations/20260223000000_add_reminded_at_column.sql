-- Add reminded_at column to track when guests were last reminded
-- Nullable: null means the guest has never been reminded

alter table public.guests
add column reminded_at timestamptz;

comment on column public.guests.reminded_at is 'Timestamp of when the most recent reminder was sent to this guest';
