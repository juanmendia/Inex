alter table public.viatic_days add column if not exists pay_via text not null default 'recibo';
alter table public.viatic_days add column if not exists paid_at timestamptz;
