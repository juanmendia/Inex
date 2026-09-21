create table if not exists public.viatic_days (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  day date not null,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (employee_id, day)
);
create index if not exists viatic_days_tenant_day_idx on public.viatic_days (tenant_id, day);
alter table public.viatic_days enable row level security;
