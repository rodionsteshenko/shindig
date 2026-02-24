-- Add allow_open_rsvp flag to events table
-- When true, anyone with the public event URL can self-register as a guest
ALTER TABLE public.events
  ADD COLUMN allow_open_rsvp boolean NOT NULL DEFAULT false;
