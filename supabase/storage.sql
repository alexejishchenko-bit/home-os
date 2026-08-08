-- Private cover images for recipes and travel places.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'covers',
  'covers',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
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
