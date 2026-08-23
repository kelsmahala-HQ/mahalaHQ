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
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'adult' check (role in ('admin', 'adult', 'kid')),
  avatar_color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Chores
-- ============================================================================

create table if not exists chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  assigned_to text,
  frequency text not null default 'once' check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  points integer not null default 0,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  last_completed_at timestamptz,
  created_at timestamptz not null default now()
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
-- Grocery list
-- ============================================================================

create table if not exists grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  quantity text,
  category text not null default 'other',
  is_checked boolean not null default false,
  added_by uuid references auth.users(id),
  created_at timestamptz not null default now()
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
  due_day integer check (due_day between 1 and 31),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references debts(id) on delete cascade,
  amount numeric(12, 2) not null,
  paid_on date not null default current_date,
  note text,
  created_at timestamptz not null default now()
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
alter table maintenance_tasks enable row level security;
alter table grocery_items enable row level security;
alter table documents enable row level security;
alter table budget_categories enable row level security;
alter table budget_transactions enable row level security;
alter table debts enable row level security;
alter table debt_payments enable row level security;

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
    'maintenance_tasks', 'grocery_items', 'documents',
    'budget_categories', 'budget_transactions', 'debts'
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
