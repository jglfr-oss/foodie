-- Run once in Supabase → SQL Editor
create table if not exists public.foodie_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
-- Lock it down: only the service role (used by the Vercel API) can read/write.
alter table public.foodie_kv enable row level security;
