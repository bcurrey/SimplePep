create table if not exists public.peptide_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  peptide text not null,
  amount numeric not null default 0,
  unit text not null default 'mg',
  timestamp timestamptz not null,
  type text not null default 'entry',
  updated_at timestamptz not null default now()
);

create table if not exists public.user_peptides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.peptide_logs enable row level security;
alter table public.user_peptides enable row level security;

create policy "Users can read their own logs"
on public.peptide_logs for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own logs"
on public.peptide_logs for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own logs"
on public.peptide_logs for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own logs"
on public.peptide_logs for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read their own peptides"
on public.user_peptides for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own peptides"
on public.user_peptides for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own peptides"
on public.user_peptides for delete
to authenticated
using ((select auth.uid()) = user_id);
