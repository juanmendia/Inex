alter table public.employees add column if not exists face_photo_path text;
alter table public.employees add column if not exists face_photo_validated boolean not null default false;
