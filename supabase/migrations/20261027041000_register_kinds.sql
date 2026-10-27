-- Safe Intelligence beta — allow gear, plant, hire, and out-of-service registers.
-- Apply on the beta project only. Do not apply this to any other project.

alter table public.registers drop constraint if exists registers_kind_check;

alter table public.registers add constraint registers_kind_check
  check (kind in ('base', 'forms', 'gear', 'plant', 'hire', 'out_of_service'));
