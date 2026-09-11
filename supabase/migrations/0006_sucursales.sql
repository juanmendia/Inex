alter table public.employees add column if not exists work_location_id uuid references public.work_locations(id);
