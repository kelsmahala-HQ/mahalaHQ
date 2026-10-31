-- ============================================================================
-- Grades feature migration -- run once in the Supabase SQL editor. Safe to re-run.
-- (Or re-run the whole supabase/schema.sql; this is the targeted subset.)
-- ============================================================================

-- 1. Let chore_completions carry points earned from grades (kind = 'grade').
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'chore_completions_kind_check') then
    alter table chore_completions drop constraint chore_completions_kind_check;
  end if;
  alter table chore_completions add constraint chore_completions_kind_check
    check (kind in ('completed', 'skipped', 'grade'));
end $$;

-- 2. Grade plans, check-ins, entries, awards.
create table if not exists grade_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references household_members(id) on delete cascade,
  label text not null,
  cash_cap integer not null default 40 check (cash_cap >= 0),
  points_per_dollar integer not null default 10 check (points_per_dollar > 0),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists grade_checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  plan_id uuid not null references grade_plans(id) on delete cascade,
  taken_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists grade_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  checkin_id uuid not null references grade_checkins(id) on delete cascade,
  plan_id uuid not null references grade_plans(id) on delete cascade,
  class_name text not null,
  grade text not null
);

create table if not exists grade_awards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  plan_id uuid not null references grade_plans(id) on delete cascade,
  member_id uuid not null references household_members(id) on delete cascade,
  class_name text,
  kind text not null check (kind in ('rescue', 'climb', 'hold', 'clean_sheet')),
  award_key text not null,
  dollars integer not null,
  points integer not null,
  created_at timestamptz not null default now(),
  unique (plan_id, award_key)
);

-- 3. Row level security: household members only.
alter table grade_plans enable row level security;
alter table grade_checkins enable row level security;
alter table grade_entries enable row level security;
alter table grade_awards enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['grade_plans', 'grade_checkins', 'grade_entries', 'grade_awards'] loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format(
      'create policy %I_all on %I for all using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()))',
      t, t
    );
  end loop;
end $$;

-- 4. Cash rewards + "still owed" tracking. A reward with cash_value becomes an IOU once approved;
--    paid_at is stamped when you hand over the money.
alter table rewards add column if not exists cash_value integer check (cash_value is null or cash_value > 0);
alter table reward_redemptions add column if not exists cash_value integer;
alter table reward_redemptions add column if not exists paid_at timestamptz;

-- 5. Weekly grade pay: awards are now one 'weekly' row per upload (plus the quarter-end bonus),
--    tagged with the check-in date so a second upload the same week can't pay twice.
alter table grade_awards add column if not exists taken_on date;
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'grade_awards_kind_check') then
    alter table grade_awards drop constraint grade_awards_kind_check;
  end if;
  alter table grade_awards add constraint grade_awards_kind_check
    check (kind in ('rescue', 'climb', 'hold', 'clean_sheet', 'weekly'));
end $$;

-- 6. Separate stores: grade points buy only grade rewards, chore points only chore rewards.
--    Everything that already exists stays in the chores store.
alter table rewards add column if not exists source text not null default 'chores' check (source in ('chores', 'grades'));
alter table reward_redemptions add column if not exists source text not null default 'chores' check (source in ('chores', 'grades'));

-- 7. Grades pay in plain dollars owed (no points, no store): each payout is a grade_awards row that
--    stays "owed" until you mark it paid. Section 6's separate grade store is no longer used and
--    can stay as-is.
alter table grade_awards add column if not exists description text;
alter table grade_awards add column if not exists paid_at timestamptz;

-- 8. Missing-assignment bonus: an optional "missing right now" count on each check-in. Pay comes
--    from how much the total dropped since the last count you entered.
alter table grade_checkins add column if not exists missing_count integer check (missing_count is null or missing_count >= 0);

-- 9. Pay by grade each week (A+ pays the most): payouts can have cents (Venmo), and each plan has its
--    own weekly cap.
alter table grade_awards alter column dollars type numeric(8,2);
alter table grade_plans add column if not exists weekly_cap integer not null default 25 check (weekly_cap >= 0);

-- 10. Stay-in rule: pay earned while a kid has more than 3 classes below a C- is held (not owed) until
--     she's back under the limit. Held pay still left when the quarter closes is forfeited.
alter table grade_awards add column if not exists held boolean not null default false;
alter table grade_awards add column if not exists forfeited boolean not null default false;

-- 11. Grade agreement: who has read and agreed, per version of the agreement.
create table if not exists grade_contract_agreements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references household_members(id) on delete cascade,
  version integer not null,
  agreed_at timestamptz not null default now(),
  unique (member_id, version)
);
alter table grade_contract_agreements enable row level security;
drop policy if exists grade_contract_agreements_all on grade_contract_agreements;
create policy grade_contract_agreements_all on grade_contract_agreements for all
  using (household_id in (select my_household_ids()))
  with check (household_id in (select my_household_ids()));
