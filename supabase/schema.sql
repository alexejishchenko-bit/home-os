-- Tasks (Дом: задачи, уборка, покупки, счета)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'task', -- task | cleaning | shopping | bill
  assigned_to text, -- 'alex' | 'jinya' | null (оба)
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  notes text,
  status text not null default 'inbox' check (status in ('inbox', 'planned', 'in_progress', 'waiting')),
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  link_url text,
  remind_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Health events (консультации, процедуры)
create table health_events (
  id uuid primary key default gen_random_uuid(),
  person text not null, -- 'alex' | 'jinya'
  type text not null, -- consultation | procedure | aligner | research
  title text not null,
  date timestamptz,
  doctor text,
  notes text,
  next_step text,
  next_date date,
  remind_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Workouts (тренировки)
create table workouts (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  date date not null default current_date,
  type text not null, -- strength | cardio | yoga | other
  exercises jsonb, -- [{name, sets, reps, weight}]
  duration_min int,
  notes text,
  created_at timestamptz not null default now()
);

-- Weight log
create table weight_log (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  date date not null default current_date,
  weight_kg numeric(4,1) not null,
  created_at timestamptz not null default now()
);

-- Travel places (wishlist + visited)
create table places (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  country text,
  city text,
  status text not null default 'wishlist', -- wishlist | planned | visited
  tags text[], -- ['горы', 'море', 'культура']
  links jsonb, -- [{url, type: 'reel'|'article'|'other', title}]
  notes text,
  image_url text,
  created_at timestamptz not null default now()
);

-- Travel documents (паспорта, визы, страховки)
create table documents (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  type text not null, -- passport | visa | insurance | other
  country text,
  title text not null,
  issue_date date,
  expires_at date,
  notes text,
  created_at timestamptz not null default now()
);

-- Recipes (понравившиеся рецепты)
create table recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  ingredients text[], -- одна строка = один ингредиент
  instructions text, -- шаги, разделены переносами строк
  prep_time_min int,
  servings int,
  source_url text,
  tags text[],
  image_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- Private conversation state for the Telegram bot
create table telegram_sessions (
  chat_id bigint primary key,
  mode text not null check (mode in ('task', 'travel', 'recipe', 'health')),
  updated_at timestamptz not null default now()
);

-- Approved Supabase Auth users for the private shared household.
create table household_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username in ('lesha', 'jinya')),
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS: family data is available only to an approved authenticated member.
alter table tasks enable row level security;
alter table health_events enable row level security;
alter table workouts enable row level security;
alter table weight_log enable row level security;
alter table places enable row level security;
alter table documents enable row level security;
alter table recipes enable row level security;
alter table household_members enable row level security;
alter table telegram_sessions enable row level security;

create policy "members can read own membership" on household_members
  for select to authenticated
  using ((select auth.uid()) = user_id and active);

create policy "household access" on tasks for all to authenticated
  using (exists (select 1 from household_members where user_id = (select auth.uid()) and active))
  with check (exists (select 1 from household_members where user_id = (select auth.uid()) and active));
create policy "household access" on health_events for all to authenticated
  using (exists (select 1 from household_members where user_id = (select auth.uid()) and active))
  with check (exists (select 1 from household_members where user_id = (select auth.uid()) and active));
create policy "household access" on workouts for all to authenticated
  using (exists (select 1 from household_members where user_id = (select auth.uid()) and active))
  with check (exists (select 1 from household_members where user_id = (select auth.uid()) and active));
create policy "household access" on weight_log for all to authenticated
  using (exists (select 1 from household_members where user_id = (select auth.uid()) and active))
  with check (exists (select 1 from household_members where user_id = (select auth.uid()) and active));
create policy "household access" on places for all to authenticated
  using (exists (select 1 from household_members where user_id = (select auth.uid()) and active))
  with check (exists (select 1 from household_members where user_id = (select auth.uid()) and active));
create policy "household access" on documents for all to authenticated
  using (exists (select 1 from household_members where user_id = (select auth.uid()) and active))
  with check (exists (select 1 from household_members where user_id = (select auth.uid()) and active));
create policy "household access" on recipes for all to authenticated
  using (exists (select 1 from household_members where user_id = (select auth.uid()) and active))
  with check (exists (select 1 from household_members where user_id = (select auth.uid()) and active));

revoke all on household_members, tasks, health_events, workouts, weight_log, places, documents, recipes from anon;
grant select on household_members to authenticated;
grant select, insert, update, delete on tasks, health_events, workouts, weight_log, places, documents, recipes to authenticated;

-- No anon/authenticated policies: only the Edge Function service role can use it.
revoke all on table telegram_sessions from anon, authenticated;
grant all on table telegram_sessions to service_role;
