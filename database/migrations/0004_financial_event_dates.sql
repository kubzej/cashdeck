-- Keep every financial event within the lifetime of its wallet.
-- Apply manually in Neon Console as the schema owner after 0003_recurring_rule_status.sql.

begin;

create function public.cashdeck_assert_transaction_after_wallet_opening()
returns trigger
language plpgsql
as $$
declare
  opening_date date;
begin
  select opening_balance_date into opening_date
  from public.wallets
  where user_id = new.user_id and id = new.wallet_id;

  if new.transaction_date < opening_date then
    raise exception 'Transaction date cannot be before the wallet opening balance date'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.cashdeck_assert_transfer_after_wallet_opening()
returns trigger
language plpgsql
as $$
declare
  source_opening_date date;
  destination_opening_date date;
begin
  select opening_balance_date into source_opening_date
  from public.wallets
  where user_id = new.user_id and id = new.source_wallet_id;

  select opening_balance_date into destination_opening_date
  from public.wallets
  where user_id = new.user_id and id = new.destination_wallet_id;

  if new.transfer_date < source_opening_date or new.transfer_date < destination_opening_date then
    raise exception 'Transfer date cannot be before either wallet opening balance date'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function public.cashdeck_assert_adjustment_after_wallet_opening()
returns trigger
language plpgsql
as $$
declare
  opening_date date;
begin
  select opening_balance_date into opening_date
  from public.wallets
  where user_id = new.user_id and id = new.wallet_id;

  if new.adjustment_date < opening_date then
    raise exception 'Balance adjustment date cannot be before the wallet opening balance date'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger transactions_require_wallet_opening_date
before insert or update of wallet_id, transaction_date on public.transactions
for each row
execute function public.cashdeck_assert_transaction_after_wallet_opening();

create trigger transfers_require_wallet_opening_date
before insert or update of source_wallet_id, destination_wallet_id, transfer_date on public.transfers
for each row
execute function public.cashdeck_assert_transfer_after_wallet_opening();

create trigger balance_adjustments_require_wallet_opening_date
before insert or update of wallet_id, adjustment_date on public.balance_adjustments
for each row
execute function public.cashdeck_assert_adjustment_after_wallet_opening();

revoke all on function public.cashdeck_assert_transaction_after_wallet_opening() from public;
revoke all on function public.cashdeck_assert_transfer_after_wallet_opening() from public;
revoke all on function public.cashdeck_assert_adjustment_after_wallet_opening() from public;

grant execute on function public.cashdeck_assert_transaction_after_wallet_opening(),
  public.cashdeck_assert_transfer_after_wallet_opening(),
  public.cashdeck_assert_adjustment_after_wallet_opening()
to cashdeck_app;

commit;
