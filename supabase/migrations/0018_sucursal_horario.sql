alter table public.work_locations add column if not exists day_start time;
alter table public.work_locations add column if not exists day_end time;
alter table public.work_locations add column if not exists afternoon_start time;
alter table public.work_locations add column if not exists afternoon_end time;
