create or replace function public.cashdeck_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.cashdeck_prevent_user_change()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.cashdeck_prevent_category_direction_change()
returns trigger
language plpgsql
as $$
begin
  if new.direction is distinct from old.direction then
    raise exception 'category direction is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.cashdeck_validate_category_direction()
returns trigger
language plpgsql
as $$
declare
  category_direction public.money_direction;
begin
  select direction into category_direction
  from public.categories
  where user_id = new.user_id and id = new.category_id;

  if category_direction is distinct from new.direction then
    raise exception 'category direction does not match record direction' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.cashdeck_validate_recurring_direction()
returns trigger
language plpgsql
as $$
declare
  category_direction public.money_direction;
begin
  if new.rule_type = 'transfer' then
    return new;
  end if;

  select direction into category_direction
  from public.categories
  where user_id = new.user_id and id = new.category_id;

  if category_direction is distinct from new.rule_type::text::public.money_direction then
    raise exception 'category direction does not match recurring rule type' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.cashdeck_validate_wallet_opening_balance()
returns trigger
language plpgsql
as $$
begin
  if (new.opening_balance_czk, new.opening_balance_date) is distinct from
     (old.opening_balance_czk, old.opening_balance_date)
     and (
       exists (select 1 from public.transactions t where t.user_id = old.user_id and t.wallet_id = old.id)
       or exists (select 1 from public.transfers t where t.user_id = old.user_id and (t.source_wallet_id = old.id or t.destination_wallet_id = old.id))
       or exists (select 1 from public.balance_adjustments a where a.user_id = old.user_id and a.wallet_id = old.id)
     ) then
    raise exception 'opening balance is locked after the first financial movement' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.cashdeck_protect_generated_fields()
returns trigger
language plpgsql
as $$
declare
  internal_write boolean := current_user in ('postgres', 'cashdeck_worker');
begin
  if tg_op = 'INSERT' and not internal_write and (
    new.recurring_rule_id is not null
    or new.recurring_occurrence_date is not null
    or new.recurring_name_snapshot is not null
  ) then
    raise exception 'recurring source fields are reserved for generation' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.recurring_occurrence_date is distinct from old.recurring_occurrence_date
       or new.recurring_name_snapshot is distinct from old.recurring_name_snapshot then
      raise exception 'generated occurrence fields are immutable' using errcode = '42501';
    end if;

    if new.recurring_rule_id is distinct from old.recurring_rule_id
       and not (old.recurring_rule_id is not null and new.recurring_rule_id is null)
       and not internal_write then
      raise exception 'recurring source fields are reserved for generation' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.cashdeck_protect_recurring_rule_type()
returns trigger
language plpgsql
as $$
begin
  if new.rule_type is distinct from old.rule_type then
    raise exception 'recurring rule type is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.cashdeck_detach_recurring_history()
returns trigger
language plpgsql
as $$
begin
  update public.transactions
  set recurring_rule_id = null
  where user_id = old.user_id and recurring_rule_id = old.id;

  update public.transfers
  set recurring_rule_id = null
  where user_id = old.user_id and recurring_rule_id = old.id;

  return old;
end;
$$;

create trigger wallets_set_updated_at before update on public.wallets
for each row execute function public.cashdeck_set_updated_at();
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.cashdeck_set_updated_at();
create trigger labels_set_updated_at before update on public.labels
for each row execute function public.cashdeck_set_updated_at();
create trigger recurring_rules_set_updated_at before update on public.recurring_rules
for each row execute function public.cashdeck_set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function public.cashdeck_set_updated_at();
create trigger transfers_set_updated_at before update on public.transfers
for each row execute function public.cashdeck_set_updated_at();
create trigger balance_adjustments_set_updated_at before update on public.balance_adjustments
for each row execute function public.cashdeck_set_updated_at();

create trigger wallets_user_id_immutable before update on public.wallets
for each row execute function public.cashdeck_prevent_user_change();
create trigger categories_user_id_immutable before update on public.categories
for each row execute function public.cashdeck_prevent_user_change();
create trigger labels_user_id_immutable before update on public.labels
for each row execute function public.cashdeck_prevent_user_change();
create trigger recurring_rules_user_id_immutable before update on public.recurring_rules
for each row execute function public.cashdeck_prevent_user_change();
create trigger transactions_user_id_immutable before update on public.transactions
for each row execute function public.cashdeck_prevent_user_change();
create trigger transfers_user_id_immutable before update on public.transfers
for each row execute function public.cashdeck_prevent_user_change();
create trigger balance_adjustments_user_id_immutable before update on public.balance_adjustments
for each row execute function public.cashdeck_prevent_user_change();

create trigger wallets_opening_balance_locked before update on public.wallets
for each row execute function public.cashdeck_validate_wallet_opening_balance();
create trigger categories_direction_immutable before update on public.categories
for each row execute function public.cashdeck_prevent_category_direction_change();
create trigger recurring_rules_type_immutable before update on public.recurring_rules
for each row execute function public.cashdeck_protect_recurring_rule_type();
create trigger recurring_rules_detach_history before delete on public.recurring_rules
for each row execute function public.cashdeck_detach_recurring_history();
create trigger recurring_rules_direction_valid after insert or update on public.recurring_rules
for each row execute function public.cashdeck_validate_recurring_direction();
create trigger transactions_direction_valid after insert or update on public.transactions
for each row execute function public.cashdeck_validate_category_direction();
create trigger transactions_generated_fields_protected before insert or update on public.transactions
for each row execute function public.cashdeck_protect_generated_fields();
create trigger transfers_generated_fields_protected before insert or update on public.transfers
for each row execute function public.cashdeck_protect_generated_fields();

create index wallets_user_order_idx on public.wallets (user_id, sort_order, id);
create index categories_user_direction_order_idx on public.categories (user_id, direction, sort_order, id);
create index labels_user_name_idx on public.labels (user_id, normalized_name);
create index transactions_user_date_idx on public.transactions (user_id, transaction_date desc, created_at desc, id desc);
create index transactions_user_wallet_date_idx on public.transactions (user_id, wallet_id, transaction_date desc, created_at desc, id desc);
create index transactions_user_category_date_idx on public.transactions (user_id, category_id, transaction_date desc);
create index transfers_user_date_idx on public.transfers (user_id, transfer_date desc, created_at desc, id desc);
create index transfers_user_source_date_idx on public.transfers (user_id, source_wallet_id, transfer_date desc);
create index transfers_user_destination_date_idx on public.transfers (user_id, destination_wallet_id, transfer_date desc);
create index adjustments_user_wallet_date_idx on public.balance_adjustments (user_id, wallet_id, adjustment_date desc);
create index recurring_rules_user_next_idx on public.recurring_rules (user_id, next_occurrence_date);
create index transaction_labels_user_label_idx on public.transaction_labels (user_id, label_id, transaction_id);
create index transfer_labels_user_label_idx on public.transfer_labels (user_id, label_id, transfer_id);
create index recurring_rule_labels_user_label_idx on public.recurring_rule_labels (user_id, label_id, recurring_rule_id);
create unique index transactions_recurring_occurrence_unique
  on public.transactions (recurring_rule_id, recurring_occurrence_date)
  where recurring_rule_id is not null and recurring_occurrence_date is not null;
create unique index transfers_recurring_occurrence_unique
  on public.transfers (recurring_rule_id, recurring_occurrence_date)
  where recurring_rule_id is not null and recurring_occurrence_date is not null;

alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.labels enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.transfers enable row level security;
alter table public.balance_adjustments enable row level security;
alter table public.transaction_labels enable row level security;
alter table public.transfer_labels enable row level security;
alter table public.recurring_rule_labels enable row level security;

create policy wallets_owner_policy on public.wallets for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy categories_owner_policy on public.categories for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy labels_owner_policy on public.labels for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy recurring_rules_owner_policy on public.recurring_rules for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy transactions_owner_policy on public.transactions for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy transfers_owner_policy on public.transfers for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy adjustments_owner_policy on public.balance_adjustments for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy transaction_labels_owner_policy on public.transaction_labels for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy transfer_labels_owner_policy on public.transfer_labels for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);
create policy recurring_rule_labels_owner_policy on public.recurring_rule_labels for all
  using ((select auth.user_id()) = user_id)
  with check ((select auth.user_id()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.seed_default_categories()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner_id text := auth.user_id();
  inserted_count integer;
begin
  if owner_id is null or btrim(owner_id) = '' then
    raise exception 'an authenticated user is required' using errcode = '42501';
  end if;

  insert into public.categories (user_id, name, normalized_name, direction, icon_key, color_key, sort_order)
  select owner_id, defaults.name, lower(defaults.name), defaults.direction, defaults.icon_key, defaults.color_key, defaults.sort_order
  from (values
    ('Domov', 'expense'::public.money_direction, 'home', 'slate', 10),
    ('Hypotéka', 'expense'::public.money_direction, 'house-dollar', 'brown', 20),
    ('Předplatné', 'expense'::public.money_direction, 'repeat', 'orange', 30),
    ('Sport', 'expense'::public.money_direction, 'dumbbell', 'green', 40),
    ('Cigarety', 'expense'::public.money_direction, 'cigarette', 'gray', 50),
    ('Slavia', 'expense'::public.money_direction, 'trophy', 'red', 60),
    ('Dar', 'expense'::public.money_direction, 'heart-handshake', 'pink', 70),
    ('Vzdělávání', 'expense'::public.money_direction, 'book-open', 'blue', 80),
    ('Zábava', 'expense'::public.money_direction, 'party-popper', 'purple', 90),
    ('Dárek', 'expense'::public.money_direction, 'gift', 'pink', 100),
    ('Oblečení', 'expense'::public.money_direction, 'shirt', 'cyan', 110),
    ('Elektronika', 'expense'::public.money_direction, 'monitor', 'indigo', 120),
    ('Zdraví', 'expense'::public.money_direction, 'heart-pulse', 'rose', 130),
    ('Nákup', 'expense'::public.money_direction, 'shopping-cart', 'teal', 140),
    ('Dovolená', 'expense'::public.money_direction, 'palmtree', 'yellow', 150),
    ('Párty', 'expense'::public.money_direction, 'martini', 'magenta', 160),
    ('MHD', 'expense'::public.money_direction, 'bus', 'blue', 170),
    ('Účty', 'expense'::public.money_direction, 'receipt', 'gray', 180),
    ('Restaurace', 'expense'::public.money_direction, 'utensils', 'orange', 190),
    ('Práce', 'expense'::public.money_direction, 'briefcase', 'navy', 200),
    ('Auto', 'expense'::public.money_direction, 'car', 'red', 210),
    ('Ostatní', 'expense'::public.money_direction, 'ellipsis', 'slate', 220),
    ('Výplata', 'income'::public.money_direction, 'wallet', 'green', 10),
    ('Dárek', 'income'::public.money_direction, 'gift', 'pink', 20),
    ('Refundace', 'income'::public.money_direction, 'rotate-ccw', 'teal', 30),
    ('Extra příjem', 'income'::public.money_direction, 'plus-circle', 'green', 40),
    ('Dar', 'income'::public.money_direction, 'heart-handshake', 'pink', 50),
    ('Prodej', 'income'::public.money_direction, 'tag', 'orange', 60),
    ('Ostatní', 'income'::public.money_direction, 'ellipsis', 'slate', 70)
  ) as defaults(name, direction, icon_key, color_key, sort_order)
  on conflict (user_id, direction, normalized_name) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
