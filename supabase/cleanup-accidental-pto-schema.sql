-- Removes the Oxford ASD PTO Portal's tables/functions/policies that got created in this
-- (mahalaHQ) Supabase project by accident. Verified against both schema.sql files first --
-- zero overlap with any real mahalaHQ table, function, or bucket name, so this only removes
-- the PTO-only objects and won't touch your household data.
-- Safe to re-run -- everything uses "if exists".
--
-- NOTE: Supabase blocks deleting storage.objects/storage.buckets rows directly via SQL
-- ("Direct deletion from storage tables is not allowed"). This script only drops the
-- storage *policies* (that part is fine via SQL) -- delete the 4 leftover buckets
-- (deposit-docs, receipts, workroom-docs, reimbursement-receipts) by hand afterward:
-- Supabase Dashboard -> Storage -> select each -> Delete. They should be empty, since the
-- PTO app was never actually used against this project.

-- Storage policies (safe via SQL -- this is metadata, not the protected row-deletion path).
drop policy if exists deposit_docs_select on storage.objects;
drop policy if exists deposit_docs_insert on storage.objects;
drop policy if exists receipts_files_select on storage.objects;
drop policy if exists receipts_files_insert on storage.objects;
drop policy if exists workroom_docs_select on storage.objects;
drop policy if exists workroom_docs_insert on storage.objects;
drop policy if exists reimbursement_receipts_select on storage.objects;
drop policy if exists reimbursement_receipts_insert on storage.objects;

-- Tables (cascade drops their triggers, indexes, and foreign keys along with them --
-- nothing here is referenced by any real mahalaHQ table, so nothing else is affected).
drop table if exists committee_chair_assignments cascade;
drop table if exists committees cascade;
drop table if exists volunteer_signups cascade;
drop table if exists volunteer_time_slots cascade;
drop table if exists volunteer_opportunities cascade;
drop table if exists workroom_documents cascade;
drop table if exists announcements cascade;
drop table if exists reimbursement_requests cascade;
drop table if exists fund_requests cascade;
drop table if exists deposits cascade;
drop table if exists receipts cascade;
drop table if exists events cascade;
drop table if exists rep_school_assignments cascade;
drop table if exists members cascade;

-- Functions (trigger functions are already detached once their tables are gone above).
drop function if exists my_member_id();
drop function if exists my_role();
drop function if exists volunteer_slot_counts();
drop function if exists lock_deposit_financial_fields();
drop function if exists lock_receipt_financial_fields();
drop function if exists lock_reimbursement_financial_fields();
drop function if exists lock_fund_request_financial_fields();
