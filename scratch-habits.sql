-- Habit tracker setup -- run once in the Supabase SQL editor. Safe to re-run.

-- ============================================================================
-- Habit tracker: personal to each household member. Unlike most tables (open to the whole
-- household), these are private at the database level -- you only ever see your own.
-- ============================================================================
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  member_id uuid not null references household_members(id) on delete cascade,
  name text not null,
  emoji text,
  days_of_week integer[], -- null = every day; otherwise 0=Sunday..6=Saturday
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists habit_checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

alter table habits enable row level security;
alter table habit_checkins enable row level security;

drop policy if exists habits_own on habits;
create policy habits_own on habits for all
  using (member_id in (select id from household_members where user_id = auth.uid()))
  with check (
    member_id in (select id from household_members where user_id = auth.uid())
    and household_id in (select my_household_ids())
  );

drop policy if exists habit_checkins_own on habit_checkins;
create policy habit_checkins_own on habit_checkins for all
  using (
    habit_id in (
      select h.id from habits h join household_members m on m.id = h.member_id where m.user_id = auth.uid()
    )
  )
  with check (
    habit_id in (
      select h.id from habits h join household_members m on m.id = h.member_id where m.user_id = auth.uid()
    )
    and household_id in (select my_household_ids())
  );
