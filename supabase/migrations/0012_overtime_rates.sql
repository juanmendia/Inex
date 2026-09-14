alter table public.collective_agreements add column if not exists rate_weekday integer default 150;
alter table public.collective_agreements add column if not exists rate_saturday integer default 200;
alter table public.collective_agreements add column if not exists rate_sunday integer default 200;
alter table public.collective_agreements add column if not exists rate_holiday integer default 200;
alter table public.collective_agreements add column if not exists rate_night integer default 200;
