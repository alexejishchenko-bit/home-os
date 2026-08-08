-- HomeOS is a private shared household. Only these confirmed Auth users may
-- access family data through the Data API and private Storage bucket.
create table if not exists public.household_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username in ('lesha', 'jinya')),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.household_members (user_id, username, display_name)
values
  ('8cc914c7-0e0f-4702-891b-e43c5122a77f', 'lesha', 'Алексей'),
  ('52d0ae42-db7d-4259-b373-ac5a83ba0570', 'jinya', 'Жиня')
on conflict (user_id) do update set
  username = excluded.username,
  display_name = excluded.display_name,
  active = true;

alter table public.household_members enable row level security;
drop policy if exists "members can read own membership" on public.household_members;
create policy "members can read own membership" on public.household_members
for select to authenticated
using ((select auth.uid()) = user_id and active);

revoke all on public.household_members from anon;
grant select on public.household_members to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tasks', 'health_events', 'workouts', 'weight_log',
    'places', 'documents', 'recipes'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "public access" on public.%I', table_name);
    execute format('drop policy if exists "household access" on public.%I', table_name);
    execute format(
      'create policy "household access" on public.%I for all to authenticated using (exists (select 1 from public.household_members where user_id = (select auth.uid()) and active)) with check (exists (select 1 from public.household_members where user_id = (select auth.uid()) and active))',
      table_name
    );
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "family covers read" on storage.objects;
drop policy if exists "family covers insert" on storage.objects;

create policy "family covers read" on storage.objects for select
to authenticated using (
  bucket_id = 'covers'
  and exists (
    select 1 from public.household_members
    where user_id = (select auth.uid()) and active
  )
);

create policy "family covers insert" on storage.objects for insert
to authenticated with check (
  bucket_id = 'covers'
  and (storage.foldername(name))[1] in ('recipes', 'travel')
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1 from public.household_members
    where user_id = (select auth.uid()) and active
  )
);
