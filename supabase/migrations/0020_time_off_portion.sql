alter table public.time_off add column if not exists portion text not null default 'full';
alter table public.time_off drop constraint if exists time_off_portion_check;
alter table public.time_off add constraint time_off_portion_check check (portion in ('full', 'morning', 'afternoon'));
