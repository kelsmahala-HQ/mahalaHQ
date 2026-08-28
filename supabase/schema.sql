-- Family Portal database schema
-- Run this once in your Supabase project's SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: uses "if not exists" / "or replace" where possible.

-- ============================================================================
-- Households & membership
-- ============================================================================

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  calendar_feed_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

-- Adds calendar_feed_token to households for installs that ran an earlier version of this script.
alter table households add column if not exists calendar_feed_token text;
update households set calendar_feed_token = encode(gen_random_bytes(16), 'hex') where calendar_feed_token is null;
alter table households alter column calendar_feed_token set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'households_calendar_feed_token_key') then
    alter table households add constraint households_calendar_feed_token_key unique (calendar_feed_token);
  end if;
end $$;

-- Optional external calendar (e.g. a Google Calendar's "Secret address in iCal format") whose
-- events are fetched read-only and overlaid on the household's own calendar view.
alter table households add column if not exists google_calendar_url text;

create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'adult' check (role in ('admin', 'adult', 'kid', 'sitter')),
  avatar_color text not null default '#6366f1',
  phone text,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- Adds phone to household_members for installs that ran an earlier version of this script.
alter table household_members add column if not exists phone text;

-- Widens the role check to include 'sitter' for installs that ran an earlier version of this script.
do $$
begin
  alter table household_members drop constraint if exists household_members_role_check;
  alter table household_members add constraint household_members_role_check
    check (role in ('admin', 'adult', 'kid', 'sitter'));
end $$;

-- Helper: households the current user belongs to. Used by every RLS policy below.
create or replace function my_household_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select household_id from household_members where user_id = auth.uid()
$$;

-- ============================================================================
-- Family profiles (school, doctor, schedules, clothing sizes, etc.)
-- ============================================================================

create table if not exists family_profiles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid references household_members(id) on delete set null, -- links this card to a real login, if they have one
  member_name text not null,
  date_of_birth date,
  school_name text,
  grade text,
  teacher text,
  doctor_name text,
  doctor_phone text,
  dentist_name text,
  dentist_phone text,
  allergies text,
  clothing_sizes text, -- free text e.g. "Shirt: 6, Pants: 6/7, Shoe: 12"
  schedule_notes text, -- free text weekly schedule / activities
  notes text,
  avatar_path text, -- path within the "avatars" storage bucket
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Adds avatar_path/member_id to family_profiles for installs that ran an earlier version of this script.
alter table family_profiles add column if not exists avatar_path text;
alter table family_profiles add column if not exists member_id uuid references household_members(id) on delete set null;

-- ============================================================================
-- Emergency contacts
-- ============================================================================

create table if not exists emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  relationship text,
  category text not null default 'other' check (category in ('medical', 'family', 'school', 'work', 'utility', 'other')),
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

-- Free-text "if something happens to me" sections (never passwords -- just where things are
-- and what to do). Auto-seeded with starter sections the first time a household visits the
-- page; fully editable/addable/removable after that.
create table if not exists emergency_info_sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  body text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Calendar
-- ============================================================================

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  assigned_to text, -- family member display name
  color text not null default '#6366f1',
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  recurrence_end date,
  event_type text not null default 'general' check (event_type in ('general', 'birthday', 'appointment', 'holiday', 'school')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Adds recurrence/event_type to calendar_events for installs that ran an earlier version of this script.
alter table calendar_events add column if not exists recurrence text not null default 'none';
alter table calendar_events add column if not exists recurrence_end date;
alter table calendar_events add column if not exists event_type text not null default 'general';

-- Links an event to a real family_profiles row instead of only a free-typed name -- null means
-- "whole family" (a shared event), matching the existing assigned_to="" convention.
alter table calendar_events add column if not exists assigned_member_id uuid references family_profiles(id) on delete set null;

-- Free-choice highlighter color for the Day Planner's hourly grid (e.g. yellow for one thing
-- today, pink for something else tomorrow) -- independent of event_type/category, and null
-- means no highlight. Not constrained to a fixed list since the whole point is picking whatever
-- color makes sense in the moment.
alter table calendar_events add column if not exists highlight_color text;
-- Adds work/college/babysitter categories for the hourly Day view -- drop+recreate (not "if not
-- exists") so installs that already have this constraint still pick up the expanded value list.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'calendar_events_event_type_check') then
    alter table calendar_events drop constraint calendar_events_event_type_check;
  end if;
  alter table calendar_events
    add constraint calendar_events_event_type_check
    check (event_type in ('general', 'birthday', 'appointment', 'holiday', 'school', 'work', 'college', 'babysitter', 'pto', 'mba'));
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'calendar_events_recurrence_check'
  ) then
    alter table calendar_events
      add constraint calendar_events_recurrence_check
      check (recurrence in ('none', 'daily', 'weekly', 'monthly', 'yearly'));
  end if;
end $$;

-- ============================================================================
-- Chores
-- ============================================================================

create table if not exists chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  assigned_to text, -- denormalized display name, kept in sync with assigned_member_id
  assigned_member_id uuid references household_members(id) on delete set null,
  frequency text not null default 'once' check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  points integer not null default 0,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  last_completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Adds assigned_member_id to chores for installs that ran an earlier version of this script.
alter table chores add column if not exists assigned_member_id uuid references household_members(id) on delete set null;

-- Widens frequency to quarterly/yearly and links back to the Cleaning Schedule task this chore
-- was created from (if any) -- drop+recreate so installs that already have this constraint
-- still pick up the expanded value list.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'chores_frequency_check') then
    alter table chores drop constraint chores_frequency_check;
  end if;
  alter table chores add constraint chores_frequency_check
    check (frequency in ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'));
end $$;

-- For a weekly chore, optionally pins it to specific weekdays (0=Sunday..6=Saturday) instead of
-- a flat "+7 days" -- e.g. every Monday/Wednesday/Friday. Null/empty means "weekly" still just
-- repeats every 7 days from its due date, unchanged.
alter table chores add column if not exists days_of_week integer[];

-- Lets a chore be assigned to more than one person (e.g. a two-person job). assigned_member_id/
-- assigned_to above stay populated too (first assignee / comma-joined names) for anything that
-- hasn't been updated to read this table -- this is the source of truth going forward.
create table if not exists chore_assignees (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  chore_id uuid not null references chores(id) on delete cascade,
  member_id uuid not null references household_members(id) on delete cascade,
  unique (chore_id, member_id)
);

-- Backfills existing chores' single assignee into the new table -- without this, a kid-visible
-- chore assigned before this migration would vanish from that kid's list (the page now filters
-- via an inner join on this table). Safe to re-run.
insert into chore_assignees (household_id, chore_id, member_id)
select household_id, id, assigned_member_id from chores where assigned_member_id is not null
on conflict (chore_id, member_id) do nothing;

-- Durable log of completed chores and the points they earned -- chores.status flips back to
-- 'open' immediately for recurring chores, so it can't be used to total up points earned.
create table if not exists chore_completions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  chore_id uuid references chores(id) on delete set null,
  member_id uuid not null references household_members(id) on delete cascade,
  points integer not null default 0,
  completed_at timestamptz not null default now()
);

-- Parent-defined catalog of things kids can redeem points for (extra screen time, allowance, etc).
create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  cost integer not null check (cost > 0),
  created_at timestamptz not null default now()
);

-- A kid's request to redeem a reward. reward_name/cost are snapshotted at request time so
-- editing or removing a reward later doesn't change the meaning of past redemptions.
create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  reward_id uuid references rewards(id) on delete set null,
  reward_name text not null,
  member_id uuid not null references household_members(id) on delete cascade,
  cost integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id)
);

-- ============================================================================
-- House maintenance
-- ============================================================================

create table if not exists maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  category text,
  frequency_days integer, -- null = one-off / as-needed
  last_done_at date,
  next_due_at date,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Cleaning schedule -- like Maintenance, but tiered to fixed named frequencies
-- (daily/weekly/monthly/quarterly/yearly) instead of an arbitrary day count.
-- ============================================================================

create table if not exists cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  assigned_to text,
  assigned_member_id uuid references household_members(id) on delete set null,
  last_done_at date,
  next_due_at date,
  notes text,
  days_of_week integer[], -- for weekly tasks: pin to specific weekdays (0=Sun..6=Sat) instead of a flat +7 days
  created_at timestamptz not null default now()
);

-- Adds days_of_week to cleaning_tasks for installs that ran an earlier version of this script.
alter table cleaning_tasks add column if not exists days_of_week integer[];

-- Same multi-assignee support as chore_assignees, for the same reason (a two-person job).
create table if not exists cleaning_task_assignees (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  cleaning_task_id uuid not null references cleaning_tasks(id) on delete cascade,
  member_id uuid not null references household_members(id) on delete cascade,
  unique (cleaning_task_id, member_id)
);

-- Same backfill reasoning as chore_assignees above. Safe to re-run.
insert into cleaning_task_assignees (household_id, cleaning_task_id, member_id)
select household_id, id, assigned_member_id from cleaning_tasks where assigned_member_id is not null
on conflict (cleaning_task_id, member_id) do nothing;

-- Links a chore back to the Cleaning Schedule task it was created from (if any), so the
-- Cleaning page can show "already added" instead of letting it be synced twice.
alter table chores add column if not exists cleaning_task_id uuid references cleaning_tasks(id) on delete cascade;

-- ============================================================================
-- Recipes & meal planner
-- ============================================================================

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  instructions text,
  servings integer,
  notes text,
  category text not null default 'dinner', -- breakfast/lunch/dinner/side/dessert/crockpot/snack
  created_at timestamptz not null default now()
);

-- Adds category to recipes for installs that ran an earlier version of this script -- the
-- default backfills every existing recipe as 'dinner' automatically.
alter table recipes add column if not exists category text not null default 'dinner';

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  name text not null,
  quantity text, -- free text e.g. "2 cups", "1 lb"
  position integer not null default 0
);

-- One row per meal slot per day. recipe_id is null for a free-typed meal (no recipe on file);
-- title is always populated (denormalized from the recipe, or typed directly) so the weekly
-- grid never needs a join just to show what's planned.
create table if not exists meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid references recipes(id) on delete set null,
  title text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Grocery list
-- ============================================================================

create table if not exists grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  quantity text,
  category text not null default 'other',
  price numeric(10, 2),
  is_checked boolean not null default false,
  added_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Adds price to grocery_items for installs that ran an earlier version of this script.
alter table grocery_items add column if not exists price numeric(10, 2);

-- Remembers the last price typed in for an item by name, separate from grocery_items itself
-- (which gets wiped by "Clear checked items") so a new "Milk" added next week can be prefilled
-- with what it cost last time, for a running budget estimate.
create table if not exists grocery_item_prices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name_key text not null, -- lowercased/trimmed name, used to match
  display_name text not null,
  last_price numeric(10, 2) not null,
  updated_at timestamptz not null default now(),
  unique (household_id, name_key)
);

-- ============================================================================
-- Documents (metadata; files live in Supabase Storage bucket "documents")
-- ============================================================================

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  category text not null default 'other',
  file_path text not null, -- path within the "documents" storage bucket
  file_name text not null,
  expires_at date,
  notes text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Budgets
-- ============================================================================

create table if not exists budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null default 'expense' check (type in ('income', 'expense')),
  monthly_limit numeric(12, 2),
  color text not null default '#6366f1',
  created_at timestamptz not null default now()
);

create table if not exists budget_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid references budget_categories(id) on delete set null,
  amount numeric(12, 2) not null,
  description text,
  occurred_on date not null default current_date,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Superseded by bills/bill_payments below (kept in place, unused, so no data is lost).

create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text not null default 'expense' check (type in ('income', 'expense')),
  category text not null default 'Other',
  amount numeric(12, 2) not null,
  frequency text not null default 'monthly'
    check (frequency in ('once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'yearly')),
  due_date date not null, -- anchor occurrence; for 'once' this is simply the transaction date
  assigned_to text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  amount numeric(12, 2) not null,
  paid_on date not null default current_date,
  created_at timestamptz not null default now()
);

-- Moves a single bill occurrence to a different pay-period week than its due-date math would
-- naturally place it in (e.g. a bill due the 4th that's actually paid whenever an earlier
-- paycheck lands) -- the bill's own recurrence is untouched, so future cycles revert unless
-- moved again.
create table if not exists bill_reschedules (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references bills(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  original_due_date date not null,
  moved_to_week_start date not null,
  created_at timestamptz not null default now(),
  unique (bill_id, original_due_date)
);

-- ============================================================================
-- Debts (tracking only -- no automated payments; see README)
-- ============================================================================

create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  creditor text,
  original_balance numeric(12, 2),
  current_balance numeric(12, 2) not null default 0,
  interest_rate numeric(5, 2),
  minimum_payment numeric(12, 2),
  due_day integer check (due_day between 1 and 31), -- used when payment_frequency = 'monthly'
  payment_frequency text not null default 'monthly' check (payment_frequency in ('monthly', 'weekly')),
  due_weekday integer check (due_weekday between 0 and 6), -- 0=Sunday..6=Saturday, used when payment_frequency = 'weekly'
  notes text,
  is_focus boolean not null default false,
  plaid_account_id text unique, -- links this row to a synced credit/loan account; null for manually-tracked debts
  created_at timestamptz not null default now()
);

-- Adds is_focus/plaid_account_id/payment_frequency/due_weekday to debts for installs that ran an earlier version of this script.
alter table debts add column if not exists is_focus boolean not null default false;
alter table debts add column if not exists plaid_account_id text;
alter table debts add column if not exists payment_frequency text not null default 'monthly';
alter table debts add column if not exists due_weekday integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'debts_payment_frequency_check') then
    alter table debts add constraint debts_payment_frequency_check check (payment_frequency in ('monthly', 'weekly'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'debts_due_weekday_check') then
    alter table debts add constraint debts_due_weekday_check check (due_weekday between 0 and 6);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'debts_plaid_account_id_key') then
    alter table debts add constraint debts_plaid_account_id_key unique (plaid_account_id);
  end if;
end $$;

-- Links a bill to the debt it was auto-created from (a minimum payment mirrored into Budget);
-- deleting the debt removes its mirrored bill too.
alter table bills add column if not exists debt_id uuid references debts(id) on delete cascade;

create table if not exists debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  amount numeric(12, 2) not null,
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Round-up tracker (spare-change savings toward the focus debt)
-- ============================================================================

create table if not exists roundup_settings (
  household_id uuid primary key references households(id) on delete cascade,
  multiplier numeric(4, 2) not null default 2,
  threshold numeric(10, 2) not null default 25,
  notified boolean not null default false, -- true once we've emailed about the current threshold crossing; resets on payout
  updated_at timestamptz not null default now()
);

-- Adds notified to roundup_settings for installs that ran an earlier version of this script.
alter table roundup_settings add column if not exists notified boolean not null default false;

create table if not exists roundup_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  amount numeric(10, 2) not null,
  round_up numeric(10, 2) not null,
  source text not null default 'manual' check (source in ('manual', 'plaid')),
  plaid_transaction_id text unique, -- prevents importing the same synced transaction twice
  merchant_name text,
  created_at timestamptz not null default now()
);

-- Adds columns to roundup_purchases for installs that ran an earlier version of this script.
alter table roundup_purchases add column if not exists source text not null default 'manual';
alter table roundup_purchases add column if not exists plaid_transaction_id text;
alter table roundup_purchases add column if not exists merchant_name text;
-- The actual date the purchase happened (from Plaid), vs. created_at which is when Mahala HQ
-- synced it -- those can differ by days if you don't open Round-Up often. Null on rows synced
-- before this column existed; the app falls back to created_at for those.
alter table roundup_purchases add column if not exists purchased_at date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'roundup_purchases_plaid_transaction_id_key') then
    alter table roundup_purchases add constraint roundup_purchases_plaid_transaction_id_key unique (plaid_transaction_id);
  end if;
end $$;

create table if not exists roundup_payouts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  debt_id uuid references debts(id) on delete set null,
  amount numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Plaid bank connections (server-only access -- see src/lib/plaid.ts)
-- ============================================================================

create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id text not null unique,
  access_token text not null, -- never selected/returned to the browser; server-side use only
  institution_name text,
  cursor text, -- pagination cursor for /transactions/sync
  created_at timestamptz not null default now()
);

-- One row per subscribed device/browser, for web push notifications. member_id is nullable so
-- a subscription still works (and can be looked up by household) even if the member row is
-- later deleted. Defined here (before the RLS section below) since the generic per-table policy
-- loop needs this table to already exist.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid references household_members(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Day Planner's quick hour highlighting -- click a time block, pick a color and an optional
-- short label (e.g. "Babysitter"), done. Deliberately NOT a calendar_events row: this is pure
-- visual context on the planner grid, not a scheduled thing with a title, so it doesn't clutter
-- the hour's event list, and doesn't show up in the month view, Google Calendar feed, or push
-- reminders. Whole-hour granularity, matching the grid's own resolution.
create table if not exists day_planner_highlights (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  start_hour integer not null check (start_hour between 0 and 23),
  span_hours integer not null default 1 check (span_hours between 1 and 24),
  color text not null,
  label text,
  created_at timestamptz not null default now()
);

-- Day Planner's To-Do and Follow-up Calls/Emails lists -- simple per-day checklists, separate
-- from calendar_events (which are time-scheduled) and from chores (which are point-scored
-- household chores, not personal/work tasks).
create table if not exists day_planner_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('todo', 'followup')),
  text text not null,
  is_done boolean not null default false,
  position integer not null default 0,
  -- Optional: also shows this same task as a block in the hourly grid, without removing it
  -- from the To-Do/Follow-up list -- checking it off anywhere marks it done everywhere, since
  -- it's the same row either way.
  scheduled_hour integer check (scheduled_hour is null or (scheduled_hour >= 0 and scheduled_hour <= 23)),
  created_at timestamptz not null default now()
);

-- Adds scheduled_hour to day_planner_tasks for installs that ran an earlier version of this script.
alter table day_planner_tasks add column if not exists scheduled_hour integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'day_planner_tasks_scheduled_hour_check') then
    alter table day_planner_tasks add constraint day_planner_tasks_scheduled_hour_check
      check (scheduled_hour is null or (scheduled_hour >= 0 and scheduled_hour <= 23));
  end if;
end $$;

-- A quick, unsorted "dump it here" capture list on the Dashboard. Items don't stay in the
-- inbox once handled -- they either get converted into a real to-do/follow-up/grocery item
-- (which deletes the inbox row and creates the target row) or just get dismissed outright.
create table if not exists inbox_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  text text not null,
  created_by uuid references household_members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Tracks which specific occurrence of a (possibly recurring) calendar event has already had
-- its 1-day/2-hour reminder sent, since recurring events don't have a separate database row
-- per occurrence. Written only by the scheduled Netlify function via the admin client -- no RLS
-- policy is added below, so it's completely inaccessible via the anon/authenticated client
-- (same intentional lockdown as plaid_items).
create table if not exists calendar_event_reminders_sent (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references calendar_events(id) on delete cascade,
  occurrence_start_at timestamptz not null,
  reminder_type text not null check (reminder_type in ('1day', '2hr')),
  sent_at timestamptz not null default now(),
  unique (event_id, occurrence_start_at, reminder_type)
);

-- ============================================================================
-- Row Level Security: every table is scoped to the caller's household(s)
-- ============================================================================

alter table households enable row level security;
alter table household_members enable row level security;
alter table family_profiles enable row level security;
alter table emergency_contacts enable row level security;
alter table calendar_events enable row level security;
alter table chores enable row level security;
alter table chore_completions enable row level security;
alter table rewards enable row level security;
alter table reward_redemptions enable row level security;
alter table maintenance_tasks enable row level security;
alter table grocery_items enable row level security;
alter table documents enable row level security;
alter table budget_categories enable row level security;
alter table budget_transactions enable row level security;
alter table debts enable row level security;
alter table debt_payments enable row level security;
alter table bills enable row level security;
alter table bill_payments enable row level security;
alter table bill_reschedules enable row level security;
alter table roundup_settings enable row level security;
alter table roundup_purchases enable row level security;
alter table roundup_payouts enable row level security;

-- plaid_items intentionally gets NO policies: RLS is enabled with zero grants, so it's
-- completely inaccessible via the anon/authenticated client no matter what the app code
-- does. It's only ever touched server-side via the secret-key admin client (src/lib/supabase/admin.ts).
alter table plaid_items enable row level security;

alter table push_subscriptions enable row level security;
alter table day_planner_tasks enable row level security;
alter table inbox_items enable row level security;
alter table emergency_info_sections enable row level security;
alter table grocery_item_prices enable row level security;

-- calendar_event_reminders_sent intentionally gets NO policies either -- same lockdown as
-- plaid_items, since it's only ever touched by the scheduled Netlify function.
alter table calendar_event_reminders_sent enable row level security;

-- households: visible to members; any authenticated user may create one (onboarding)
drop policy if exists households_select on households;
create policy households_select on households for select
  using (id in (select my_household_ids()));

drop policy if exists households_insert on households;
create policy households_insert on households for insert
  with check (auth.uid() is not null);

drop policy if exists households_update on households;
create policy households_update on households for update
  using (id in (select my_household_ids()));

-- household_members: visible to fellow members; a user may add themself (join/onboard)
drop policy if exists household_members_select on household_members;
create policy household_members_select on household_members for select
  using (household_id in (select my_household_ids()));

drop policy if exists household_members_insert on household_members;
create policy household_members_insert on household_members for insert
  with check (user_id = auth.uid());

drop policy if exists household_members_update on household_members;
create policy household_members_update on household_members for update
  using (user_id = auth.uid());

-- Generic per-table policy for the rest: full CRUD for any member of the household.
do $$
declare
  t text;
  tables text[] := array[
    'family_profiles', 'emergency_contacts', 'calendar_events', 'chores',
    'chore_completions', 'rewards', 'reward_redemptions',
    'maintenance_tasks', 'grocery_items', 'documents',
    'budget_categories', 'budget_transactions', 'debts', 'bills', 'bill_payments', 'bill_reschedules',
    'roundup_settings', 'roundup_purchases', 'roundup_payouts', 'push_subscriptions', 'day_planner_tasks',
    'day_planner_highlights', 'cleaning_tasks', 'recipes', 'recipe_ingredients', 'meal_plan_entries',
    'chore_assignees', 'cleaning_task_assignees', 'inbox_items', 'emergency_info_sections',
    'grocery_item_prices'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I_all on %I', t, t);
    execute format(
      'create policy %I_all on %I for all using (household_id in (select my_household_ids())) with check (household_id in (select my_household_ids()))',
      t, t
    );
  end loop;
end $$;

-- debt_payments is scoped via its parent debt's household
drop policy if exists debt_payments_all on debt_payments;
create policy debt_payments_all on debt_payments for all
  using (debt_id in (select id from debts where household_id in (select my_household_ids())))
  with check (debt_id in (select id from debts where household_id in (select my_household_ids())));

-- ============================================================================
-- Storage bucket for documents
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_storage_all on storage.objects;
create policy documents_storage_all on storage.objects for all
  using (bucket_id = 'documents' and (storage.foldername(name))[1] in (select my_household_ids()::text))
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] in (select my_household_ids()::text));

-- ============================================================================
-- Storage bucket for family member avatars
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

drop policy if exists avatars_storage_all on storage.objects;
create policy avatars_storage_all on storage.objects for all
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] in (select my_household_ids()::text))
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] in (select my_household_ids()::text));
