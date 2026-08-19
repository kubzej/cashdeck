create extension if not exists pgcrypto;

create type public.money_direction as enum ('income', 'expense');
create type public.recurring_rule_type as enum ('income', 'expense', 'transfer');
create type public.adjustment_operation as enum ('add', 'subtract');
create type public.recurrence_unit as enum ('day', 'week', 'month', 'year');

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (btrim(user_id) <> ''),
  name text not null check (name = btrim(name) and name <> '' and length(name) <= 120),
  color_key text not null check (color_key ~ '^[a-z0-9_-]+$'),
  opening_balance_czk bigint not null default 0,
  opening_balance_date date not null default current_date,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index wallets_user_name_unique
  on public.wallets (user_id, lower(btrim(name)));

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (btrim(user_id) <> ''),
  name text not null check (
    name = btrim(name)
    and name <> ''
    and length(name) <= 120
    and left(name, 1) = upper(left(name, 1))
  ),
  normalized_name text not null check (normalized_name = lower(btrim(name))),
  direction public.money_direction not null,
  icon_key text not null check (icon_key ~ '^[a-z0-9_-]+$'),
  color_key text not null check (color_key ~ '^[a-z0-9_-]+$'),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, direction, normalized_name)
);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (btrim(user_id) <> ''),
  name text not null check (
    name = btrim(name)
    and name <> ''
    and length(name) <= 120
    and name = lower(name)
  ),
  normalized_name text not null check (normalized_name = lower(btrim(name))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, normalized_name)
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (btrim(user_id) <> ''),
  rule_type public.recurring_rule_type not null,
  name text not null check (name = btrim(name) and name <> '' and length(name) <= 120),
  amount_czk bigint not null check (amount_czk > 0),
  wallet_id uuid,
  category_id uuid,
  source_wallet_id uuid,
  destination_wallet_id uuid,
  recurrence_unit public.recurrence_unit not null,
  recurrence_interval integer not null check (recurrence_interval > 0),
  anchor_day_of_month integer,
  anchor_month integer,
  next_occurrence_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete restrict,
  foreign key (user_id, category_id) references public.categories (user_id, id) on delete restrict,
  foreign key (user_id, source_wallet_id) references public.wallets (user_id, id) on delete restrict,
  foreign key (user_id, destination_wallet_id) references public.wallets (user_id, id) on delete restrict,
  check (
    (
      rule_type in ('income', 'expense')
      and wallet_id is not null
      and category_id is not null
      and source_wallet_id is null
      and destination_wallet_id is null
    )
    or (
      rule_type = 'transfer'
      and wallet_id is null
      and category_id is null
      and source_wallet_id is not null
      and destination_wallet_id is not null
      and source_wallet_id <> destination_wallet_id
    )
  ),
  check (
    (recurrence_unit = 'day' and recurrence_interval >= 1 and anchor_day_of_month is null and anchor_month is null)
    or (recurrence_unit = 'week' and recurrence_interval in (1, 2) and anchor_day_of_month is null and anchor_month is null)
    or (recurrence_unit = 'month' and recurrence_interval in (1, 2, 3, 6) and anchor_day_of_month between 1 and 31 and anchor_month is null)
    or (recurrence_unit = 'year' and recurrence_interval = 1 and anchor_day_of_month between 1 and 31 and anchor_month between 1 and 12)
  ),
  check (end_date is null or end_date >= next_occurrence_date)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (btrim(user_id) <> ''),
  wallet_id uuid not null,
  category_id uuid not null,
  direction public.money_direction not null,
  amount_czk bigint not null check (amount_czk > 0),
  transaction_date date not null,
  note text check (note is null or (note = btrim(note) and length(note) <= 2000)),
  recurring_rule_id uuid,
  recurring_occurrence_date date,
  recurring_name_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete restrict,
  foreign key (user_id, category_id) references public.categories (user_id, id) on delete restrict,
  foreign key (user_id, recurring_rule_id) references public.recurring_rules (user_id, id) on delete restrict,
  check (
    (recurring_rule_id is null and recurring_occurrence_date is null and recurring_name_snapshot is null)
    or (recurring_rule_id is null and recurring_occurrence_date is not null and recurring_name_snapshot is not null)
    or (recurring_rule_id is not null and recurring_occurrence_date is not null and recurring_name_snapshot is not null)
  )
);

create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (btrim(user_id) <> ''),
  source_wallet_id uuid not null,
  destination_wallet_id uuid not null,
  amount_czk bigint not null check (amount_czk > 0),
  transfer_date date not null,
  note text check (note is null or (note = btrim(note) and length(note) <= 2000)),
  recurring_rule_id uuid,
  recurring_occurrence_date date,
  recurring_name_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, source_wallet_id) references public.wallets (user_id, id) on delete restrict,
  foreign key (user_id, destination_wallet_id) references public.wallets (user_id, id) on delete restrict,
  foreign key (user_id, recurring_rule_id) references public.recurring_rules (user_id, id) on delete restrict,
  check (source_wallet_id <> destination_wallet_id),
  check (
    (recurring_rule_id is null and recurring_occurrence_date is null and recurring_name_snapshot is null)
    or (recurring_rule_id is null and recurring_occurrence_date is not null and recurring_name_snapshot is not null)
    or (recurring_rule_id is not null and recurring_occurrence_date is not null and recurring_name_snapshot is not null)
  )
);

create table public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (btrim(user_id) <> ''),
  wallet_id uuid not null,
  amount_czk bigint not null check (amount_czk > 0),
  operation public.adjustment_operation not null,
  adjustment_date date not null,
  note text check (note is null or (note = btrim(note) and length(note) <= 2000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, wallet_id) references public.wallets (user_id, id) on delete restrict
);

create table public.transaction_labels (
  user_id text not null check (btrim(user_id) <> ''),
  transaction_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, transaction_id, label_id),
  foreign key (user_id, transaction_id) references public.transactions (user_id, id) on delete cascade,
  foreign key (user_id, label_id) references public.labels (user_id, id) on delete cascade
);

create table public.transfer_labels (
  user_id text not null check (btrim(user_id) <> ''),
  transfer_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, transfer_id, label_id),
  foreign key (user_id, transfer_id) references public.transfers (user_id, id) on delete cascade,
  foreign key (user_id, label_id) references public.labels (user_id, id) on delete cascade
);

create table public.recurring_rule_labels (
  user_id text not null check (btrim(user_id) <> ''),
  recurring_rule_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, recurring_rule_id, label_id),
  foreign key (user_id, recurring_rule_id) references public.recurring_rules (user_id, id) on delete cascade,
  foreign key (user_id, label_id) references public.labels (user_id, id) on delete cascade
);
