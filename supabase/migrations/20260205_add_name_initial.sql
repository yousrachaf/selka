alter table public.participations
  add column if not exists name_initial text;

create index if not exists participations_name_lookup_idx
  on public.participations (group_id, lower(display_name), name_initial);
