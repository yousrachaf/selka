alter table public.participations
  add column if not exists cancelled_at timestamptz;

create index if not exists participations_cancelled_at_idx
  on public.participations (cancelled_at);
