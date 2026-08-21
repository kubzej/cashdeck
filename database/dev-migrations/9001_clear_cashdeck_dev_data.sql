-- TEMPORARY DEVELOPMENT SCRIPT
-- Removes all Cashdeck application data for Jakub's current Neon Auth user.
-- It deliberately does not touch the Neon Auth account itself.
-- Run this manually in the Neon SQL editor before 9002_seed_cashdeck_dev_data.sql.

begin;

do $$
begin
  if exists (
    select 1
    from (
      select user_id from public.user_settings
      union
      select user_id from public.wallets
      union
      select user_id from public.categories
      union
      select user_id from public.labels
      union
      select user_id from public.transactions
      union
      select user_id from public.transfers
      union
      select user_id from public.balance_adjustments
      union
      select user_id from public.recurring_rules
    ) as cashdeck_users
    where user_id <> 'eb36e232-9279-4a04-8716-4171115e817e'
  ) then
    raise exception
      'This temporary reset found Cashdeck data for a different user, aborting.';
  end if;
end
$$;

delete from public.recurring_rules
where user_id = 'eb36e232-9279-4a04-8716-4171115e817e';

delete from public.balance_adjustments
where user_id = 'eb36e232-9279-4a04-8716-4171115e817e';

delete from public.transactions
where user_id = 'eb36e232-9279-4a04-8716-4171115e817e';

delete from public.transfers
where user_id = 'eb36e232-9279-4a04-8716-4171115e817e';

delete from public.labels
where user_id = 'eb36e232-9279-4a04-8716-4171115e817e';

delete from public.categories
where user_id = 'eb36e232-9279-4a04-8716-4171115e817e';

delete from public.wallets
where user_id = 'eb36e232-9279-4a04-8716-4171115e817e';

delete from public.user_settings
where user_id = 'eb36e232-9279-4a04-8716-4171115e817e';

commit;
