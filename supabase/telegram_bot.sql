-- Inbound Telegram bot setup. Secret values are configured in Supabase Vault,
-- never in this repository.

create table if not exists public.telegram_sessions (
  chat_id bigint primary key,
  mode text not null check (mode in ('task', 'travel', 'recipe', 'health')),
  updated_at timestamptz not null default now()
);

alter table public.telegram_sessions enable row level security;
revoke all on table public.telegram_sessions from anon, authenticated;
grant all on table public.telegram_sessions to service_role;

alter table public.telegram_sessions
  drop constraint if exists telegram_sessions_mode_check;
alter table public.telegram_sessions
  add constraint telegram_sessions_mode_check
  check (mode in ('task', 'travel', 'recipe', 'health'));

create index if not exists telegram_sessions_updated_at_idx
  on public.telegram_sessions (updated_at);

create or replace function public.telegram_bot_config()
returns jsonb
language sql
security definer
set search_path = public, vault, pg_catalog
as $$
  select jsonb_object_agg(name, decrypted_secret)
  from vault.decrypted_secrets
  where name in (
    'telegram_bot_token',
    'telegram_webhook_secret',
    'telegram_chat_alex',
    'telegram_chat_jinya',
    'apify_api_token',
    'gemini_api_key'
  );
$$;

revoke all on function public.telegram_bot_config() from public, anon, authenticated;
grant execute on function public.telegram_bot_config() to service_role;
