alter table public.places
  add column if not exists photos text[],
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists distance_km numeric(7,1),
  add column if not exists drive_minutes integer,
  add column if not exists enriched_at timestamptz;
