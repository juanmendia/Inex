alter table public.tenant_settings add column if not exists require_mobile_punch boolean not null default false;

alter table public.attendance_records add column if not exists work_location_id uuid references public.work_locations(id);
alter table public.attendance_records add column if not exists site_latitude double precision;
alter table public.attendance_records add column if not exists site_longitude double precision;
alter table public.attendance_records add column if not exists distance_meters integer;
alter table public.attendance_records add column if not exists within_geofence boolean;
