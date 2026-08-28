-- Resyncs the "assigned to" text shown on Chores and the Cleaning Schedule so it matches
-- current household member names, instead of whatever name was on file when each one was
-- created/assigned. Safe to re-run any time someone's name changes.

update chores c
set assigned_to = sub.names
from (
  select ca.chore_id, string_agg(hm.display_name, ', ' order by hm.display_name) as names
  from chore_assignees ca
  join household_members hm on hm.id = ca.member_id
  group by ca.chore_id
) sub
where c.id = sub.chore_id;

update cleaning_tasks ct
set assigned_to = sub.names
from (
  select cta.cleaning_task_id, string_agg(hm.display_name, ', ' order by hm.display_name) as names
  from cleaning_task_assignees cta
  join household_members hm on hm.id = cta.member_id
  group by cta.cleaning_task_id
) sub
where ct.id = sub.cleaning_task_id;
