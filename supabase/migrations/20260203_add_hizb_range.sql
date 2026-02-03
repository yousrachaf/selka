alter table public.participations
  add column if not exists start_hizb integer,
  add column if not exists end_hizb integer;

alter table public.participations
  drop constraint if exists participations_hizb_taken_check,
  add constraint participations_hizb_taken_check check (hizb_taken in (1, 2));

alter table public.participations
  drop constraint if exists participations_hizb_range_check,
  add constraint participations_hizb_range_check check (
    start_hizb >= 1
    and end_hizb <= 60
    and start_hizb <= end_hizb
  );
