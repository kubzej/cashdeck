-- Recurring transaction and transfer rules.
-- Apply manually in Neon Console as the schema owner after review.

begin;

create type public.recurring_rule_kind as enum ('transaction', 'transfer');
create type public.recurring_frequency as enum (
  'daily',
  'weekly',
  'biweekly',
  'monthly',
  'every_two_months',
  'every_three_months',
  'semiannual',
  'yearly',
  'custom_days'
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  kind public.recurring_rule_kind not null,
  amount_czk bigint not null,
  transaction_wallet_id uuid,
  category_id uuid,
  source_wallet_id uuid,
  destination_wallet_id uuid,
  note text,
  frequency public.recurring_frequency not null,
  custom_interval_days integer,
  schedule_anchor_date date not null,
  next_occurrence_date date not null,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_rules_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint recurring_rules_name_trimmed_and_not_blank
    check (name = btrim(name) and name <> ''),
  constraint recurring_rules_amount_czk_positive
    check (amount_czk > 0),
  constraint recurring_rules_note_trimmed_and_not_blank
    check (note is null or (note = btrim(note) and note <> '')),
  constraint recurring_rules_custom_interval_matches_frequency
    check (
      (frequency = 'custom_days' and custom_interval_days is not null and custom_interval_days >= 1)
      or (frequency <> 'custom_days' and custom_interval_days is null)
    ),
  constraint recurring_rules_end_is_not_before_next_occurrence
    check (ends_on is null or ends_on >= next_occurrence_date),
  constraint recurring_rules_payload_matches_kind
    check (
      (
        kind = 'transaction'
        and transaction_wallet_id is not null
        and category_id is not null
        and source_wallet_id is null
        and destination_wallet_id is null
      )
      or (
        kind = 'transfer'
        and transaction_wallet_id is null
        and category_id is null
        and source_wallet_id is not null
        and destination_wallet_id is not null
        and source_wallet_id <> destination_wallet_id
      )
    ),
  constraint recurring_rules_user_id_id_unique unique (user_id, id),
  constraint recurring_rules_transaction_wallet_same_user_fkey
    foreign key (user_id, transaction_wallet_id)
    references public.wallets (user_id, id)
    on delete restrict,
  constraint recurring_rules_category_same_user_fkey
    foreign key (user_id, category_id)
    references public.categories (user_id, id)
    on delete restrict,
  constraint recurring_rules_source_wallet_same_user_fkey
    foreign key (user_id, source_wallet_id)
    references public.wallets (user_id, id)
    on delete restrict,
  constraint recurring_rules_destination_wallet_same_user_fkey
    foreign key (user_id, destination_wallet_id)
    references public.wallets (user_id, id)
    on delete restrict
);

create trigger recurring_rules_set_updated_at
before update on public.recurring_rules
for each row
execute function public.cashdeck_set_updated_at();

create table public.recurring_rule_labels (
  user_id text not null,
  recurring_rule_id uuid not null,
  label_id uuid not null,
  primary key (user_id, recurring_rule_id, label_id),
  constraint recurring_rule_labels_rule_same_user_fkey
    foreign key (user_id, recurring_rule_id)
    references public.recurring_rules (user_id, id)
    on delete cascade,
  constraint recurring_rule_labels_label_same_user_fkey
    foreign key (user_id, label_id)
    references public.labels (user_id, id)
    on delete cascade
);

create table public.recurring_rule_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  recurring_rule_id uuid not null,
  occurrence_date date not null,
  transaction_id uuid,
  transfer_id uuid,
  generated_at timestamptz not null default now(),
  constraint recurring_rule_occurrences_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint recurring_rule_occurrences_exactly_one_record
    check (num_nonnulls(transaction_id, transfer_id) = 1),
  constraint recurring_rule_occurrences_user_rule_date_unique
    unique (user_id, recurring_rule_id, occurrence_date),
  constraint recurring_rule_occurrences_user_id_id_unique unique (user_id, id),
  constraint recurring_rule_occurrences_rule_same_user_fkey
    foreign key (user_id, recurring_rule_id)
    references public.recurring_rules (user_id, id)
    on delete cascade,
  constraint recurring_rule_occurrences_transaction_same_user_fkey
    foreign key (user_id, transaction_id)
    references public.transactions (user_id, id)
    on delete cascade,
  constraint recurring_rule_occurrences_transfer_same_user_fkey
    foreign key (user_id, transfer_id)
    references public.transfers (user_id, id)
    on delete cascade
);

create index recurring_rules_user_next_occurrence_idx
on public.recurring_rules (user_id, next_occurrence_date asc, id asc);

create index recurring_rule_labels_user_label_idx
on public.recurring_rule_labels (user_id, label_id, recurring_rule_id);

grant usage on type public.recurring_rule_kind, public.recurring_frequency
to cashdeck_app;

grant select, insert, update, delete
on table public.recurring_rules,
  public.recurring_rule_labels,
  public.recurring_rule_occurrences
to cashdeck_app;

commit;
