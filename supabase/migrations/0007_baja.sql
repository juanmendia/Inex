alter table public.employees add column if not exists terminated_at date;
alter table public.employees add column if not exists termination_reason text;
