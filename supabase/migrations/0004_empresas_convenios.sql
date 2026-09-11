-- Un usuario puede administrar varias empresas (un rol por empresa).
alter table public.user_roles drop constraint if exists user_roles_pkey;
alter table public.user_roles add column if not exists id uuid default gen_random_uuid();
update public.user_roles set id = gen_random_uuid() where id is null;
alter table public.user_roles alter column id set not null;
alter table public.user_roles add primary key (id);
create unique index if not exists user_roles_scoped_uidx
  on public.user_roles (user_id, role, tenant_id)
  where tenant_id is not null;
create unique index if not exists user_roles_global_uidx
  on public.user_roles (user_id, role)
  where tenant_id is null;

create table if not exists public.collective_agreements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  monthly_hours numeric,
  notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.salary_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  previous_amount numeric,
  new_amount numeric not null,
  percent numeric,
  effective_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

alter table public.employees add column if not exists agreement_id uuid references public.collective_agreements(id);

alter table public.collective_agreements enable row level security;
alter table public.salary_changes enable row level security;

create policy agreements_staff on public.collective_agreements
  for all using (tenant_id = public.current_tenant_id() and public.is_tenant_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_staff());

create policy salary_changes_staff on public.salary_changes
  for all using (tenant_id = public.current_tenant_id() and public.is_tenant_staff())
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_staff());
