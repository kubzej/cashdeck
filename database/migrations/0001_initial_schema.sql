-- Cashdeck initial schema.
-- Apply manually once in Neon Console as the schema owner after Phase 3 review.

begin;

create type public.money_direction as enum ('income', 'expense');
create type public.balance_adjustment_operation as enum ('add', 'subtract');

create function public.cashdeck_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.user_settings (
  user_id text primary key,
  default_categories_seeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> '')
);

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.cashdeck_set_updated_at();

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  normalized_name text generated always as (lower(name)) stored,
  color_key text not null,
  opening_balance_czk bigint not null default 0,
  opening_balance_date date not null default current_date,
  sort_order integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallets_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint wallets_name_trimmed_and_not_blank
    check (name = btrim(name) and name <> ''),
  constraint wallets_color_key_trimmed_and_not_blank
    check (color_key = btrim(color_key) and color_key <> ''),
  constraint wallets_sort_order_non_negative
    check (sort_order >= 0),
  constraint wallets_user_id_id_unique unique (user_id, id),
  constraint wallets_user_id_normalized_name_unique unique (user_id, normalized_name)
);

create trigger wallets_set_updated_at
before update on public.wallets
for each row
execute function public.cashdeck_set_updated_at();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  normalized_name text generated always as (lower(name)) stored,
  direction public.money_direction not null,
  icon_key text not null,
  color_key text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint categories_name_trimmed_and_not_blank
    check (name = btrim(name) and name <> ''),
  constraint categories_name_starts_uppercase
    check (
      left(name, 1) = upper(left(name, 1))
      and left(name, 1) <> lower(left(name, 1))
    ),
  constraint categories_icon_key_trimmed_and_not_blank
    check (icon_key = btrim(icon_key) and icon_key <> ''),
  constraint categories_color_key_trimmed_and_not_blank
    check (color_key = btrim(color_key) and color_key <> ''),
  constraint categories_sort_order_non_negative
    check (sort_order >= 0),
  constraint categories_user_id_id_unique unique (user_id, id),
  constraint categories_user_id_direction_normalized_name_unique
    unique (user_id, direction, normalized_name)
);

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.cashdeck_set_updated_at();

create function public.cashdeck_prevent_category_direction_change()
returns trigger
language plpgsql
as $$
begin
  if new.direction is distinct from old.direction then
    raise exception 'Category direction cannot be changed';
  end if;

  return new;
end;
$$;

create trigger categories_prevent_direction_change
before update on public.categories
for each row
execute function public.cashdeck_prevent_category_direction_change();

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  normalized_name text generated always as (lower(name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint labels_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint labels_name_trimmed_and_not_blank
    check (name = btrim(name) and name <> ''),
  constraint labels_name_lowercase
    check (name = lower(name)),
  constraint labels_user_id_id_unique unique (user_id, id),
  constraint labels_user_id_normalized_name_unique unique (user_id, normalized_name)
);

create trigger labels_set_updated_at
before update on public.labels
for each row
execute function public.cashdeck_set_updated_at();

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  wallet_id uuid not null,
  category_id uuid not null,
  amount_czk bigint not null,
  transaction_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint transactions_amount_czk_positive
    check (amount_czk > 0),
  constraint transactions_note_trimmed_and_not_blank
    check (note is null or (note = btrim(note) and note <> '')),
  constraint transactions_user_id_id_unique unique (user_id, id),
  constraint transactions_wallet_same_user_fkey
    foreign key (user_id, wallet_id)
    references public.wallets (user_id, id)
    on delete restrict,
  constraint transactions_category_same_user_fkey
    foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on delete restrict
);

create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.cashdeck_set_updated_at();

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_wallet_id uuid not null,
  destination_wallet_id uuid not null,
  amount_czk bigint not null,
  transfer_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfers_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint transfers_wallet_endpoints_differ
    check (source_wallet_id <> destination_wallet_id),
  constraint transfers_amount_czk_positive
    check (amount_czk > 0),
  constraint transfers_note_trimmed_and_not_blank
    check (note is null or (note = btrim(note) and note <> '')),
  constraint transfers_user_id_id_unique unique (user_id, id),
  constraint transfers_source_wallet_same_user_fkey
    foreign key (user_id, source_wallet_id)
    references public.wallets (user_id, id)
    on delete restrict,
  constraint transfers_destination_wallet_same_user_fkey
    foreign key (user_id, destination_wallet_id)
    references public.wallets (user_id, id)
    on delete restrict
);

create trigger transfers_set_updated_at
before update on public.transfers
for each row
execute function public.cashdeck_set_updated_at();

create table public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  wallet_id uuid not null,
  amount_czk bigint not null,
  operation public.balance_adjustment_operation not null,
  adjustment_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint balance_adjustments_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint balance_adjustments_amount_czk_positive
    check (amount_czk > 0),
  constraint balance_adjustments_note_trimmed_and_not_blank
    check (note is null or (note = btrim(note) and note <> '')),
  constraint balance_adjustments_user_id_id_unique unique (user_id, id),
  constraint balance_adjustments_wallet_same_user_fkey
    foreign key (user_id, wallet_id)
    references public.wallets (user_id, id)
    on delete restrict
);

create trigger balance_adjustments_set_updated_at
before update on public.balance_adjustments
for each row
execute function public.cashdeck_set_updated_at();

create table public.transaction_labels (
  user_id text not null,
  transaction_id uuid not null,
  label_id uuid not null,
  primary key (user_id, transaction_id, label_id),
  constraint transaction_labels_transaction_same_user_fkey
    foreign key (user_id, transaction_id)
    references public.transactions (user_id, id)
    on delete cascade,
  constraint transaction_labels_label_same_user_fkey
    foreign key (user_id, label_id)
    references public.labels (user_id, id)
    on delete cascade
);

create table public.transfer_labels (
  user_id text not null,
  transfer_id uuid not null,
  label_id uuid not null,
  primary key (user_id, transfer_id, label_id),
  constraint transfer_labels_transfer_same_user_fkey
    foreign key (user_id, transfer_id)
    references public.transfers (user_id, id)
    on delete cascade,
  constraint transfer_labels_label_same_user_fkey
    foreign key (user_id, label_id)
    references public.labels (user_id, id)
    on delete cascade
);

create function public.cashdeck_lock_wallet_opening_balance()
returns trigger
language plpgsql
as $$
begin
  if new.opening_balance_czk is not distinct from old.opening_balance_czk
    and new.opening_balance_date is not distinct from old.opening_balance_date then
    return new;
  end if;

  if exists (
    select 1
    from public.transactions
    where user_id = old.user_id
      and wallet_id = old.id
  ) or exists (
    select 1
    from public.transfers
    where user_id = old.user_id
      and (source_wallet_id = old.id or destination_wallet_id = old.id)
  ) or exists (
    select 1
    from public.balance_adjustments
    where user_id = old.user_id
      and wallet_id = old.id
  ) then
    raise exception 'Wallet opening balance cannot change after linked financial records exist';
  end if;

  return new;
end;
$$;

create trigger wallets_lock_opening_balance
before update of opening_balance_czk, opening_balance_date on public.wallets
for each row
execute function public.cashdeck_lock_wallet_opening_balance();

create index wallets_user_sort_order_idx
on public.wallets (user_id, sort_order asc, id asc);

create index categories_user_direction_sort_order_idx
on public.categories (user_id, direction, sort_order asc, id asc);

create index transactions_user_date_idx
on public.transactions (user_id, transaction_date desc, created_at desc, id desc);

create index transactions_user_wallet_date_idx
on public.transactions (
  user_id,
  wallet_id,
  transaction_date desc,
  created_at desc,
  id desc
);

create index transactions_user_category_date_idx
on public.transactions (user_id, category_id, transaction_date desc);

create index transfers_user_date_idx
on public.transfers (user_id, transfer_date desc, created_at desc, id desc);

create index transfers_user_source_wallet_date_idx
on public.transfers (
  user_id,
  source_wallet_id,
  transfer_date desc,
  created_at desc,
  id desc
);

create index transfers_user_destination_wallet_date_idx
on public.transfers (
  user_id,
  destination_wallet_id,
  transfer_date desc,
  created_at desc,
  id desc
);

create index balance_adjustments_user_wallet_date_idx
on public.balance_adjustments (
  user_id,
  wallet_id,
  adjustment_date desc,
  created_at desc,
  id desc
);

create index transaction_labels_user_label_idx
on public.transaction_labels (user_id, label_id, transaction_id);

create index transfer_labels_user_label_idx
on public.transfer_labels (user_id, label_id, transfer_id);

revoke create on schema public from public;
grant usage on schema public to cashdeck_app;

grant usage on type public.money_direction, public.balance_adjustment_operation
to cashdeck_app;

grant select, insert, update, delete
on table public.user_settings,
  public.wallets,
  public.categories,
  public.labels,
  public.transactions,
  public.transfers,
  public.balance_adjustments,
  public.transaction_labels,
  public.transfer_labels
to cashdeck_app;

revoke all on function public.cashdeck_set_updated_at() from public;
revoke all on function public.cashdeck_prevent_category_direction_change() from public;
revoke all on function public.cashdeck_lock_wallet_opening_balance() from public;

grant execute on function public.cashdeck_set_updated_at(),
  public.cashdeck_prevent_category_direction_change(),
  public.cashdeck_lock_wallet_opening_balance()
to cashdeck_app;

commit;
