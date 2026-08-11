-- Telegram reminders for HomeOS tasks and health events.
-- Required Vault secrets (values are configured outside the repository):
-- telegram_bot_token, telegram_chat_alex, telegram_chat_jinya

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create index if not exists tasks_pending_reminders_idx
  on public.tasks (remind_at)
  where reminder_sent_at is null and done = false;

alter table public.health_events
  add column if not exists remind_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;

create index if not exists health_events_pending_reminders_idx
  on public.health_events (remind_at)
  where reminder_sent_at is null;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.send_task_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, pg_catalog
as $$
declare
  task_row record;
  chat_id text;
  bot_token text;
  recipient_ids text[];
  message_text text;
begin
  select decrypted_secret into bot_token
  from vault.decrypted_secrets
  where name = 'telegram_bot_token';

  if bot_token is null then
    raise exception 'Telegram bot token is not configured';
  end if;

  for task_row in
    select id, title, assigned_to, due_date, priority
    from public.tasks
    where remind_at is not null
      and remind_at <= now()
      and reminder_sent_at is null
      and done = false
    order by remind_at
  loop
    if task_row.assigned_to = 'alex' then
      select array_agg(decrypted_secret) into recipient_ids
      from vault.decrypted_secrets where name = 'telegram_chat_alex';
    elsif task_row.assigned_to = 'jinya' then
      select array_agg(decrypted_secret) into recipient_ids
      from vault.decrypted_secrets where name = 'telegram_chat_jinya';
    else
      select array_agg(decrypted_secret order by name) into recipient_ids
      from vault.decrypted_secrets where name in ('telegram_chat_alex', 'telegram_chat_jinya');
    end if;

    message_text := '🔔 HomeOS' || E'\n' || task_row.title;
    if task_row.priority = 'urgent' then
      message_text := message_text || E'\n' || 'Приоритет: срочный';
    elsif task_row.priority = 'high' then
      message_text := message_text || E'\n' || 'Приоритет: важный';
    end if;
    if task_row.due_date is not null then
      message_text := message_text || E'\n' || 'Дедлайн: ' || to_char(task_row.due_date, 'DD.MM.YYYY');
    end if;

    foreach chat_id in array coalesce(recipient_ids, array[]::text[])
    loop
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', chat_id,
          'text', message_text,
          'disable_web_page_preview', true
        )
      );
    end loop;

    update public.tasks set reminder_sent_at = now() where id = task_row.id;
  end loop;
end;
$$;

revoke all on function private.send_task_reminders() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'home-os-task-reminders';

select cron.schedule(
  'home-os-task-reminders',
  '* * * * *',
  $$select private.send_task_reminders();$$
);

create or replace function private.send_health_reminders()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, pg_catalog
as $$
declare
  event_row record;
  chat_id text;
  bot_token text;
  message_text text;
begin
  select decrypted_secret into bot_token
  from vault.decrypted_secrets
  where name = 'telegram_bot_token';

  if bot_token is null then
    raise exception 'Telegram bot token is not configured';
  end if;

  for event_row in
    select id, person
    from public.health_events
    where remind_at is not null
      and remind_at <= now()
      and reminder_sent_at is null
    order by remind_at
  loop
    select decrypted_secret into chat_id
    from vault.decrypted_secrets
    where name = case event_row.person
      when 'alex' then 'telegram_chat_alex'
      when 'jinya' then 'telegram_chat_jinya'
    end;

    if chat_id is not null then
      -- Keep medical details inside HomeOS; Telegram receives no sensitive payload.
      message_text := '🩺 Напоминание о здоровье' || E'\n' || 'Открой HomeOS, чтобы посмотреть детали.';

      perform net.http_post(
        url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', chat_id,
          'text', message_text,
          'disable_web_page_preview', true
        )
      );

      update public.health_events
      set reminder_sent_at = now()
      where id = event_row.id;
    end if;
  end loop;
end;
$$;

revoke all on function private.send_health_reminders() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'home-os-health-reminders';

select cron.schedule(
  'home-os-health-reminders',
  '* * * * *',
  $$select private.send_health_reminders();$$
);

-- Keep pg_cron history useful without letting minute-by-minute reminder jobs
-- grow the database indefinitely.
select cron.unschedule(jobid)
from cron.job
where jobname = 'home-os-cron-log-retention';

select cron.schedule(
  'home-os-cron-log-retention',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days';$$
);
