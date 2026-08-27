-- Undoes the accidental second $1.12 round-up payout (from the double-tap on Send),
-- putting the $1.12 back in the jar and back onto C1 Blue's balance.

delete from roundup_payouts where id = '35bcba4c-b5df-4333-a8fb-e2aab5918272';

delete from debt_payments where id = '5631315d-b139-4925-8985-e99b78476ae7';

update debts set current_balance = current_balance + 1.12
where id = 'a407c0c0-4aee-4027-8d9f-665045ab34f3';
