alter table public.tenant_settings add column if not exists monthly_hours numeric not null default 176;

alter table public.payroll_novelties add column if not exists hours numeric;
alter table public.payroll_novelties add column if not exists rate_percent integer;
