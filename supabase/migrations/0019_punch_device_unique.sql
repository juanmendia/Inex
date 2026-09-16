-- Un celular, un empleado. Si ya hay duplicados, se desvinculan los extras.
update public.employees e
set punch_device_id = null
where e.punch_device_id is not null
  and e.id not in (
    select distinct on (tenant_id, punch_device_id) id
    from public.employees
    where punch_device_id is not null
    order by tenant_id, punch_device_id, id
  );

create unique index if not exists employees_punch_device_unique
  on public.employees (tenant_id, punch_device_id)
  where punch_device_id is not null;
