-- ============================================================================
-- Chore overhaul migration -- run once in the Supabase SQL editor.
-- Safe to re-run. (Or just re-run the whole supabase/schema.sql; this is the
-- targeted subset.)
-- ============================================================================

-- 1. Eligibility: who is ALLOWED to claim/complete a chore. Separate from
--    chore_assignees (whose chore it is / who gets reminders). Zero rows for a
--    chore = everyone is eligible.
create table if not exists chore_eligibility (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  chore_id uuid not null references chores(id) on delete cascade,
  member_id uuid not null references household_members(id) on delete cascade,
  unique (chore_id, member_id)
);

alter table chore_eligibility enable row level security;
drop policy if exists chore_eligibility_all on chore_eligibility;
create policy chore_eligibility_all on chore_eligibility for all
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));

-- Backfill: existing chores keep their current visibility (eligibility = current
-- assignees). Chores with no assignee stay everyone-eligible.
insert into chore_eligibility (household_id, chore_id, member_id)
select household_id, chore_id, member_id from chore_assignees
on conflict (chore_id, member_id) do nothing;

-- 2. chore_completions: approval + skip + history snapshots.
alter table chore_completions add column if not exists approval_status text not null default 'approved';
alter table chore_completions add column if not exists kind text not null default 'completed';
alter table chore_completions add column if not exists chore_title text;
alter table chore_completions add column if not exists member_name text;
alter table chore_completions add column if not exists decided_at timestamptz;
alter table chore_completions add column if not exists decided_by uuid references auth.users(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chore_completions_approval_status_check') then
    alter table chore_completions add constraint chore_completions_approval_status_check
      check (approval_status in ('approved', 'pending', 'rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chore_completions_kind_check') then
    alter table chore_completions add constraint chore_completions_kind_check
      check (kind in ('completed', 'skipped'));
  end if;
end $$;

-- Existing rows keep their meaning: default 'approved'/'completed' means every
-- historical completion still counts toward balances exactly as before.
