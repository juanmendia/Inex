create table if not exists public.time_off (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  kind text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'pending',
  note text,
  created_by uuid,
  decided_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists time_off_tenant_idx on public.time_off (tenant_id, starts_on);
alter table public.time_off enable row level security;
