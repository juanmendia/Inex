-- ponytail: correr en SQL Editor si 0001 ya estaba aplicado.

alter table public.employees add column if not exists base_salary numeric;

alter table public.attendance_records add column if not exists punch_type text not null default 'in';

alter table public.payroll_runs add column if not exists kind text not null default 'monthly';
alter table public.payroll_runs add column if not exists closed_at timestamptz;

create table if not exists public.payroll_novelties (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  period_year integer not null,
  period_month integer not null,
  concept text not null,
  amount numeric not null default 0,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  concept text not null,
  amount numeric not null,
  created_at timestamptz not null default now()
);

alter table public.payroll_novelties enable row level security;
alter table public.payroll_items enable row level security;

drop policy if exists payroll_novelties_staff on public.payroll_novelties;
create policy payroll_novelties_staff on public.payroll_novelties for all using (
  tenant_id = public.current_tenant_id() and public.is_tenant_staff()
);

drop policy if exists payroll_items_staff on public.payroll_items;
create policy payroll_items_staff on public.payroll_items for all using (
  tenant_id = public.current_tenant_id() and public.is_tenant_staff()
);
