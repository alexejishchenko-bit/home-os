-- Tasks (Дом: задачи, уборка, покупки, счета)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'task', -- task | cleaning | shopping | bill
  assigned_to text, -- 'alex' | 'kate' | null (оба)
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- Health events (консультации, процедуры)
create table health_events (
  id uuid primary key default gen_random_uuid(),
  person text not null, -- 'alex' | 'kate'
  type text not null, -- consultation | procedure | aligner | research
  title text not null,
  date date,
  doctor text,
  notes text,
  next_step text,
  next_date date,
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

-- RLS: открываем всё без авторизации (семейный инструмент)
alter table tasks enable row level security;
alter table health_events enable row level security;
alter table workouts enable row level security;
alter table weight_log enable row level security;
alter table places enable row level security;
alter table documents enable row level security;

create policy "public access" on tasks for all using (true) with check (true);
create policy "public access" on health_events for all using (true) with check (true);
create policy "public access" on workouts for all using (true) with check (true);
create policy "public access" on weight_log for all using (true) with check (true);
create policy "public access" on places for all using (true) with check (true);
create policy "public access" on documents for all using (true) with check (true);
