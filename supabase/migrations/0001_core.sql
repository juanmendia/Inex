-- Inex core: tenants, RBAC, employees, documents/receipts, tickets, events,
-- notifications, audit + stubs payroll/attendance.

create extension if not exists pgcrypto;

-- ---------- enums ----------
do $$ begin
  create type tenant_status as enum ('active', 'suspended', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('active', 'disabled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employee_status as enum ('active', 'inactive', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_type as enum ('receipt', 'contract', 'certificate', 'policy', 'notice', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_status as enum ('pending', 'available', 'signed', 'non_conforming', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type receipt_status as enum ('pending', 'signed', 'non_conforming', 'expired', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum ('open', 'in_progress', 'answered', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_category as enum ('receipt', 'salary', 'vacation', 'leave', 'documents', 'health', 'personal', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum ('training', 'meeting', 'internal', 'anniversary', 'holiday', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type birthday_visibility as enum ('public', 'department', 'private');
exception when duplicate_object then null; end $$;

do $$ begin
  create type audit_action as enum (
    'login','logout','create','update','delete','view','download',
    'sign','sign_non_conform','upload','publish','answer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type role_code as enum ('super_admin','tenant_admin','hr_admin','hr_operator','employee');
exception when duplicate_object then null; end $$;

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_profile_id()
returns uuid language sql stable as $$
  select auth.uid();
$$;

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.has_role(codes role_code[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any (codes)
  );
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['super_admin']::role_code[]);
$$;

create or replace function public.is_tenant_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(array['tenant_admin','hr_admin','hr_operator']::role_code[]);
$$;

-- ---------- core tables ----------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status tenant_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  legal_name text,
  cuit text,
  logo_path text,
  primary_color text default '#4f46e5',
  secondary_color text default '#f59e0b',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  birthday_visibility birthday_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id),
  email text not null,
  full_name text,
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role role_code not null,
  tenant_id uuid references public.tenants(id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid unique references public.profiles(id),
  employee_number text not null,
  first_name text not null,
  last_name text not null,
  dni text,
  email text,
  phone text,
  birth_date date,
  hire_date date,
  department_id uuid references public.departments(id),
  position_id uuid references public.positions(id),
  status employee_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, employee_number)
);

create index if not exists employees_tenant_id_idx on public.employees (tenant_id);
create index if not exists employees_dni_idx on public.employees (tenant_id, dni);

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null,
  checksum text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid references public.employees(id),
  type document_type not null,
  title text not null,
  status document_status not null default 'pending',
  current_file_id uuid references public.files(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_tenant_employee_idx on public.documents (tenant_id, employee_id);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  file_id uuid not null references public.files(id),
  version integer not null,
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document_id uuid not null unique references public.documents(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  period_year integer not null,
  period_month integer not null check (period_month between 1 and 12),
  kind text not null default 'haberes',
  status receipt_status not null default 'pending',
  published_at timestamptz,
  due_at timestamptz,
  payroll_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receipts_tenant_employee_idx on public.receipts (tenant_id, employee_id);
create index if not exists receipts_status_idx on public.receipts (tenant_id, status);

create table if not exists public.receipt_signatures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  action text not null check (action in ('conform', 'non_conform')),
  reason text,
  ip_address inet,
  user_agent text,
  document_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  category ticket_category not null default 'other',
  subject text not null,
  status ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hr_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ticket_id uuid not null references public.hr_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  type event_type not null default 'internal',
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  body text not null,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, read_at);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  user_id uuid references public.profiles(id),
  action audit_action not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_idx on public.audit_logs (tenant_id, created_at desc);

-- ---------- stubs (sin UI) ----------
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_year integer not null,
  period_month integer not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.work_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  latitude double precision,
  longitude double precision,
  radius_meters integer default 150,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references public.employees(id),
  method text not null default 'web',
  recorded_at timestamptz not null default now(),
  server_recorded_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

-- ---------- triggers ----------
drop trigger if exists tenants_updated_at on public.tenants;
create trigger tenants_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists employees_updated_at on public.employees;
create trigger employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------
alter table public.tenants enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;
alter table public.employees enable row level security;
alter table public.files enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_signatures enable row level security;
alter table public.hr_tickets enable row level security;
alter table public.hr_ticket_messages enable row level security;
alter table public.events enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.work_locations enable row level security;
alter table public.attendance_records enable row level security;

-- profiles: self + same tenant staff + super admin
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or public.is_super_admin()
  or (tenant_id is not null and tenant_id = public.current_tenant_id() and public.is_tenant_staff())
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid());

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select using (
  public.is_super_admin() or id = public.current_tenant_id()
);

drop policy if exists tenant_settings_select on public.tenant_settings;
create policy tenant_settings_select on public.tenant_settings for select using (
  public.is_super_admin() or tenant_id = public.current_tenant_id()
);

drop policy if exists tenant_settings_update on public.tenant_settings;
create policy tenant_settings_update on public.tenant_settings for update using (
  tenant_id = public.current_tenant_id() and public.has_role(array['tenant_admin']::role_code[])
);

-- generic tenant isolation for staff+own employee data
drop policy if exists departments_tenant on public.departments;
create policy departments_tenant on public.departments for all using (
  public.is_super_admin() or tenant_id = public.current_tenant_id()
);

drop policy if exists positions_tenant on public.positions;
create policy positions_tenant on public.positions for all using (
  public.is_super_admin() or tenant_id = public.current_tenant_id()
);

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select using (
  public.is_super_admin()
  or (tenant_id = public.current_tenant_id() and public.is_tenant_staff())
  or user_id = auth.uid()
);

drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees for all using (
  tenant_id = public.current_tenant_id()
  and public.has_role(array['tenant_admin','hr_admin']::role_code[])
);

drop policy if exists files_tenant on public.files;
create policy files_tenant on public.files for select using (
  public.is_super_admin()
  or tenant_id = public.current_tenant_id()
);

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select using (
  public.is_super_admin()
  or (tenant_id = public.current_tenant_id() and public.is_tenant_staff())
  or employee_id in (select id from public.employees where user_id = auth.uid())
);

drop policy if exists receipts_select on public.receipts;
create policy receipts_select on public.receipts for select using (
  public.is_super_admin()
  or (tenant_id = public.current_tenant_id() and public.is_tenant_staff())
  or employee_id in (select id from public.employees where user_id = auth.uid())
);

drop policy if exists receipts_write on public.receipts;
create policy receipts_write on public.receipts for all using (
  tenant_id = public.current_tenant_id()
  and public.has_role(array['tenant_admin','hr_admin','hr_operator']::role_code[])
);

drop policy if exists signatures_select on public.receipt_signatures;
create policy signatures_select on public.receipt_signatures for select using (
  public.is_super_admin()
  or (tenant_id = public.current_tenant_id() and public.is_tenant_staff())
  or employee_id in (select id from public.employees where user_id = auth.uid())
);

drop policy if exists signatures_insert on public.receipt_signatures;
create policy signatures_insert on public.receipt_signatures for insert with check (
  employee_id in (select id from public.employees where user_id = auth.uid())
);

drop policy if exists tickets_select on public.hr_tickets;
create policy tickets_select on public.hr_tickets for select using (
  tenant_id = public.current_tenant_id() and (
    public.is_tenant_staff()
    or employee_id in (select id from public.employees where user_id = auth.uid())
  )
);

drop policy if exists tickets_insert on public.hr_tickets;
create policy tickets_insert on public.hr_tickets for insert with check (
  employee_id in (select id from public.employees where user_id = auth.uid())
);

drop policy if exists ticket_messages_select on public.hr_ticket_messages;
create policy ticket_messages_select on public.hr_ticket_messages for select using (
  ticket_id in (select id from public.hr_tickets)
);

drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (
  tenant_id = public.current_tenant_id()
);

drop policy if exists events_write on public.events;
create policy events_write on public.events for all using (
  tenant_id = public.current_tenant_id() and public.is_tenant_staff()
);

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select using (
  tenant_id = public.current_tenant_id()
);

drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (user_id = auth.uid());

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select using (
  public.is_super_admin()
  or (tenant_id = public.current_tenant_id() and public.is_tenant_staff())
);

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert with check (true);

drop policy if exists payroll_staff on public.payroll_runs;
create policy payroll_staff on public.payroll_runs for all using (
  tenant_id = public.current_tenant_id() and public.is_tenant_staff()
);

drop policy if exists work_locations_tenant on public.work_locations;
create policy work_locations_tenant on public.work_locations for select using (
  tenant_id = public.current_tenant_id()
);

drop policy if exists attendance_select on public.attendance_records;
create policy attendance_select on public.attendance_records for select using (
  public.is_tenant_staff()
  or employee_id in (select id from public.employees where user_id = auth.uid())
);

-- audit: no update/delete for normal roles
revoke update, delete on public.audit_logs from anon, authenticated;
