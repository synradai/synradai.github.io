-- Safe Intelligence beta — hse_records ids are unique per organisation.
-- Apply on the beta project only, after 20261019060723_beta_hse_records.sql.
-- Do not apply this to the live project (ref rgkiagqexoafmtxhrlqo).
--
-- Client ids are short text tokens, not uuids. A global primary key on id
-- would reject the same token in a second organisation. The key is
-- (org_id, id). RLS still limits each caller to current_org_id().

alter table public.hse_records drop constraint if exists hse_records_pkey;

alter table public.hse_records
  add constraint hse_records_pkey primary key (org_id, id);
