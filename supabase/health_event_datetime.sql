-- Health appointments need an exact moment, while Telegram reminders keep
-- their own independent timestamp in remind_at.
alter table public.health_events
  alter column date type timestamptz
  using (date::timestamp at time zone 'Europe/Moscow');
