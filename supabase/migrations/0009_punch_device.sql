alter table public.employees add column if not exists punch_device_id text;
alter table public.attendance_records add column if not exists photo_path text;
alter table public.attendance_records add column if not exists device_id text;
