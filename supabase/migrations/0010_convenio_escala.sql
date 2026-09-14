alter table public.collective_agreements add column if not exists scale_amount numeric;
alter table public.collective_agreements add column if not exists day_start time;
alter table public.collective_agreements add column if not exists day_end time;
alter table public.collective_agreements add column if not exists afternoon_start time;
alter table public.collective_agreements add column if not exists afternoon_end time;
alter table public.employees add column if not exists salary_addon numeric default 0;
