-- Catálogo de licencias por empresa + certificado en el pedido.

create table if not exists public.leave_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  name text not null,
  employee_can_request boolean not null default true,
  requires_certificate boolean not null default false,
  active boolean not null default true,
  sort integer not null default 0,
  unique (tenant_id, code)
);
create index if not exists leave_types_tenant_idx on public.leave_types (tenant_id, sort);
alter table public.leave_types enable row level security;

alter table public.time_off add column if not exists leave_type_id uuid references public.leave_types(id);
alter table public.time_off add column if not exists certificate_path text;
