-- Financial independence tracking ("Nezávislost"): wallet type + FIRE flags,
-- plus persisted independence settings (withdrawal rate, expense
-- assumptions, irregular expenses).
-- Apply manually in Neon Console as the schema owner after review.

begin;

create type public.wallet_type as enum (
  'cash', 'checking', 'savings', 'investment', 'pension', 'crypto', 'other'
);

alter table public.wallets
  add column wallet_type public.wallet_type not null default 'other',
  add column counts_toward_independence boolean not null default false,
  add column available_now boolean not null default false,
  add constraint wallets_available_now_requires_counting
    check (not available_now or counts_toward_independence);

create table public.independence_settings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  withdrawal_rate_percent numeric(5,2) not null default 4.00,
  expected_real_return_percent numeric(5,2) not null default 4.00,
  inflation_rate_percent numeric(5,2) not null default 2.50,
  monthly_contribution_czk bigint not null default 0,
  housing_monthly_czk bigint not null default 0,
  food_monthly_czk bigint not null default 0,
  transport_monthly_czk bigint not null default 0,
  health_monthly_czk bigint not null default 0,
  leisure_monthly_czk bigint not null default 0,
  clothing_monthly_czk bigint not null default 0,
  family_monthly_czk bigint not null default 0,
  reserve_monthly_czk bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint independence_settings_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint independence_settings_withdrawal_rate_sane
    check (withdrawal_rate_percent > 0 and withdrawal_rate_percent <= 20),
  constraint independence_settings_real_return_sane
    check (expected_real_return_percent >= 0 and expected_real_return_percent <= 20),
  constraint independence_settings_inflation_sane
    check (inflation_rate_percent >= 0 and inflation_rate_percent <= 20),
  constraint independence_settings_amounts_non_negative check (
    monthly_contribution_czk >= 0 and housing_monthly_czk >= 0 and
    food_monthly_czk >= 0 and transport_monthly_czk >= 0 and
    health_monthly_czk >= 0 and leisure_monthly_czk >= 0 and
    clothing_monthly_czk >= 0 and family_monthly_czk >= 0 and
    reserve_monthly_czk >= 0
  )
);

create trigger independence_settings_set_updated_at
before update on public.independence_settings
for each row
execute function public.cashdeck_set_updated_at();

create table public.independence_irregular_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  amount_czk bigint not null,
  frequency_years integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint independence_irregular_user_id_not_blank
    check (user_id = btrim(user_id) and user_id <> ''),
  constraint independence_irregular_name_trimmed_and_not_blank
    check (name = btrim(name) and name <> ''),
  constraint independence_irregular_amount_positive check (amount_czk > 0),
  constraint independence_irregular_frequency_positive check (frequency_years > 0),
  constraint independence_irregular_user_id_id_unique unique (user_id, id)
);

create trigger independence_irregular_set_updated_at
before update on public.independence_irregular_expenses
for each row
execute function public.cashdeck_set_updated_at();

grant usage on type public.wallet_type to cashdeck_app;

grant select, insert, update, delete
on table public.independence_settings,
  public.independence_irregular_expenses
to cashdeck_app;

commit;
