-- TEMPORARY DEVELOPMENT SCRIPT
-- Creates a realistic Cashdeck dataset for Jakub's current Neon Auth user.
-- Run 9001_clear_cashdeck_dev_data.sql first. Do not treat this as a production migration.

begin;

do $$
begin
  if exists (select 1 from public.wallets)
    or exists (select 1 from public.categories)
    or exists (select 1 from public.labels)
    or exists (select 1 from public.transactions)
    or exists (select 1 from public.transfers)
    or exists (select 1 from public.recurring_rules) then
    raise exception 'Cashdeck data already exists. Run 9001_clear_cashdeck_dev_data.sql first.';
  end if;
end
$$;

create temporary table cashdeck_dev_seed_context (
  user_id text primary key
) on commit drop;

insert into cashdeck_dev_seed_context (user_id)
values ('eb36e232-9279-4a04-8716-4171115e817e');

insert into public.user_settings (user_id, default_categories_seeded_at)
values ('eb36e232-9279-4a04-8716-4171115e817e', now())
on conflict (user_id) do update
set default_categories_seeded_at = excluded.default_categories_seeded_at;

insert into public.wallets (
  user_id,
  name,
  color_key,
  opening_balance_czk,
  opening_balance_date,
  sort_order
)
select
  context.user_id,
  wallet.name,
  wallet.color_key,
  wallet.opening_balance_czk,
  wallet.opening_balance_date,
  wallet.sort_order
from cashdeck_dev_seed_context context
cross join (
  values
    ('Běžný účet', 'teal', 78000::bigint, (current_date - interval '14 months')::date, 0),
    ('Spoření', 'blue', 260000::bigint, (current_date - interval '14 months')::date, 1),
    ('Revolut', 'violet', 4000::bigint, (current_date - interval '10 months')::date, 2),
    ('Hotovost', 'amber', 1500::bigint, (current_date - interval '14 months')::date, 3)
) as wallet(name, color_key, opening_balance_czk, opening_balance_date, sort_order);

insert into public.categories (
  user_id,
  name,
  direction,
  icon_key,
  color_key,
  sort_order
)
select
  context.user_id,
  category.name,
  category.direction::public.money_direction,
  category.icon_key,
  category.color_key,
  category.sort_order
from cashdeck_dev_seed_context context
cross join (
  values
    ('Bydlení', 'expense', 'house', 'brown', 0),
    ('Nákup', 'expense', 'shopping-basket', 'green', 1),
    ('Restaurace', 'expense', 'utensils', 'orange', 2),
    ('Doprava', 'expense', 'tram-front', 'blue', 3),
    ('Předplatné', 'expense', 'repeat-2', 'violet', 4),
    ('Zdraví', 'expense', 'heart-pulse', 'red', 5),
    ('Sport', 'expense', 'dumbbell', 'teal', 6),
    ('Zábava', 'expense', 'clapperboard', 'pink', 7),
    ('Dovolená', 'expense', 'plane', 'sky', 8),
    ('Ostatní', 'expense', 'ellipsis', 'gray', 9),
    ('Výplata', 'income', 'banknote-arrow-up', 'green', 0),
    ('Freelance', 'income', 'briefcase-business', 'blue', 1),
    ('Refundace', 'income', 'rotate-ccw', 'teal', 2),
    ('Prodej', 'income', 'tags', 'orange', 3),
    ('Dárek', 'income', 'gift', 'pink', 4),
    ('Úroky', 'income', 'landmark', 'violet', 5),
    ('Bonus', 'income', 'circle-plus', 'lime', 6),
    ('Dividendy', 'income', 'hand-coins', 'yellow', 7),
    ('Vrácené peníze', 'income', 'receipt-text', 'green', 8),
    ('Ostatní', 'income', 'ellipsis', 'gray', 9)
) as category(name, direction, icon_key, color_key, sort_order);

insert into public.labels (user_id, name)
select context.user_id, label.name
from cashdeck_dev_seed_context context
cross join (
  values
    ('albert'),
    ('lidl'),
    ('rohlik'),
    ('bolt'),
    ('uber'),
    ('netflix'),
    ('spotify'),
    ('gym'),
    ('fotbal'),
    ('dovolena'),
    ('prace'),
    ('rodina'),
    ('byt'),
    ('auto'),
    ('lekar'),
    ('vikend'),
    ('rezerva'),
    ('investice'),
    ('cestovani'),
    ('kava')
) as label(name);

-- Main account activity: income, recurring living costs and day-to-day spending.
insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Výplata' and direction = 'income'),
  (58400 + ((extract(month from month_date)::integer % 3) * 500))::bigint,
  month_date::date,
  'Výplata'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date,
  current_date,
  interval '1 month'
) as month_series(month_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Bydlení' and direction = 'expense'),
  17800,
  month_date::date + 2,
  'Nájem'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date,
  current_date,
  interval '1 month'
) as month_series(month_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Bydlení' and direction = 'expense'),
  (2450 + ((extract(month from month_date)::integer % 4) * 120))::bigint,
  month_date::date + 7,
  'Energie a služby'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date,
  current_date,
  interval '1 month'
) as month_series(month_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Předplatné' and direction = 'expense'),
  938,
  month_date::date + 11,
  'Netflix, Spotify a cloud'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date,
  current_date,
  interval '1 month'
) as month_series(month_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Nákup' and direction = 'expense'),
  (750 + ((extract(day from activity_date)::integer % 5) * 265))::bigint,
  activity_date::date,
  'Nákup potravin'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date,
  current_date,
  interval '7 days'
) as activity_series(activity_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Restaurace' and direction = 'expense'),
  (260 + ((extract(day from activity_date)::integer % 6) * 115))::bigint,
  activity_date::date,
  'Oběd nebo káva'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date + 3,
  current_date,
  interval '16 days'
) as activity_series(activity_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Doprava' and direction = 'expense'),
  (120 + ((extract(day from activity_date)::integer % 4) * 95))::bigint,
  activity_date::date,
  'MHD a doprava'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date + 5,
  current_date,
  interval '21 days'
) as activity_series(activity_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Sport' and direction = 'expense'),
  1190,
  month_date::date + 14,
  'Fitness členství'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date,
  current_date,
  interval '1 month'
) as month_series(month_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Zdraví' and direction = 'expense'),
  (500 + ((extract(month from month_date)::integer % 3) * 280))::bigint,
  month_date::date + 18,
  'Lékárna a prevence'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '12 months')::date,
  current_date,
  interval '3 months'
) as month_series(month_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Freelance' and direction = 'income'),
  (12000 + ((extract(month from month_date)::integer % 4) * 2500))::bigint,
  month_date::date + 9,
  'Freelance projekt'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '11 months')::date,
  current_date,
  interval '2 months'
) as month_series(month_date);

insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = 'Běžný účet'),
  (select id from public.categories where user_id = context.user_id and name = 'Refundace' and direction = 'income'),
  (400 + ((extract(month from month_date)::integer % 4) * 210))::bigint,
  month_date::date + 20,
  'Vrácení platby'
from cashdeck_dev_seed_context context
cross join generate_series(
  (current_date - interval '11 months')::date,
  current_date,
  interval '3 months'
) as month_series(month_date);

-- A smaller set of intentional outliers plus future manual transactions.
insert into public.transactions (user_id, wallet_id, category_id, amount_czk, transaction_date, note)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = seed.wallet_name),
  (
    select id
    from public.categories
    where user_id = context.user_id
      and name = seed.category_name
      and direction = seed.direction::public.money_direction
  ),
  seed.amount_czk,
  current_date + seed.day_offset,
  seed.note
from cashdeck_dev_seed_context context
cross join (
  values
    ('Běžný účet', 'Dovolená', 'expense', 14600::bigint, -318, 'Letenky do Lisabonu'),
    ('Běžný účet', 'Zábava', 'expense', 1890::bigint, -163, 'Koncert'),
    ('Hotovost', 'Restaurace', 'expense', 320::bigint, -91, 'Večeře s kamarády'),
    ('Revolut', 'Doprava', 'expense', 410::bigint, -58, 'Bolt na letiště'),
    ('Spoření', 'Úroky', 'income', 1240::bigint, -31, 'Připsaný úrok'),
    ('Běžný účet', 'Prodej', 'income', 6500::bigint, -14, 'Prodej starého telefonu'),
    ('Běžný účet', 'Ostatní', 'expense', 950::bigint, -6, 'Drobná domácnost'),
    ('Běžný účet', 'Dovolená', 'expense', 8900::bigint, 8, 'Ubytování na dovolené'),
    ('Běžný účet', 'Zdraví', 'expense', 1650::bigint, 13, 'Zubní hygiena'),
    ('Běžný účet', 'Refundace', 'income', 990::bigint, 17, 'Refundace letenky'),
    ('Revolut', 'Doprava', 'expense', 380::bigint, 21, 'Metro v zahraničí'),
    ('Běžný účet', 'Dárek', 'income', 2500::bigint, 28, 'Narozeninový dárek')
) as seed(wallet_name, category_name, direction, amount_czk, day_offset, note);

insert into public.transfers (
  user_id,
  source_wallet_id,
  destination_wallet_id,
  amount_czk,
  transfer_date,
  note
)
select
  context.user_id,
  (select id from public.wallets where user_id = context.user_id and name = seed.source_wallet_name),
  (select id from public.wallets where user_id = context.user_id and name = seed.destination_wallet_name),
  seed.amount_czk,
  current_date + seed.day_offset,
  seed.note
from cashdeck_dev_seed_context context
cross join (
  values
    ('Běžný účet', 'Spoření', 20000::bigint, -336, 'Měsíční rezerva'),
    ('Běžný účet', 'Spoření', 15000::bigint, -276, 'Měsíční rezerva'),
    ('Běžný účet', 'Revolut', 4500::bigint, -224, 'Dovolená'),
    ('Běžný účet', 'Spoření', 25000::bigint, -184, 'Měsíční rezerva'),
    ('Běžný účet', 'Revolut', 3500::bigint, -132, 'Víkendový výlet'),
    ('Běžný účet', 'Spoření', 18000::bigint, -92, 'Měsíční rezerva'),
    ('Spoření', 'Běžný účet', 6000::bigint, -51, 'Přesun na výdaje'),
    ('Běžný účet', 'Revolut', 5000::bigint, -11, 'Cesta do Berlína'),
    ('Běžný účet', 'Spoření', 18000::bigint, 9, 'Zářijová rezerva'),
    ('Spoření', 'Běžný účet', 4500::bigint, 24, 'Přesun na výdaje')
) as seed(source_wallet_name, destination_wallet_name, amount_czk, day_offset, note);

-- Attach labels with enough variety to exercise label filters and compact cards.
insert into public.transaction_labels (user_id, transaction_id, label_id)
select
  transaction.user_id,
  transaction.id,
  label.id
from public.transactions transaction
join public.categories category on category.id = transaction.category_id
join public.labels label on label.user_id = transaction.user_id
where transaction.user_id = (select user_id from cashdeck_dev_seed_context)
  and label.name = case
    when transaction.note = 'Nákup potravin' then case extract(day from transaction.transaction_date)::integer % 3
      when 0 then 'albert'
      when 1 then 'lidl'
      else 'rohlik'
    end
    when transaction.note = 'Oběd nebo káva' then case extract(day from transaction.transaction_date)::integer % 2
      when 0 then 'kava'
      else 'vikend'
    end
    when category.name = 'Bydlení' then 'byt'
    when category.name = 'Předplatné' then 'netflix'
    when category.name = 'Sport' then 'gym'
    when category.name = 'Zdraví' then 'lekar'
    when category.name = 'Doprava' then 'auto'
    when category.name in ('Výplata', 'Freelance') then 'prace'
    when category.name = 'Dovolená' then 'cestovani'
    when category.name = 'Zábava' then 'vikend'
    else null
  end;

insert into public.transaction_labels (user_id, transaction_id, label_id)
select transaction.user_id, transaction.id, label.id
from public.transactions transaction
join public.labels label on label.user_id = transaction.user_id and label.name = 'spotify'
where transaction.user_id = (select user_id from cashdeck_dev_seed_context)
  and transaction.note = 'Netflix, Spotify a cloud';

insert into public.transfer_labels (user_id, transfer_id, label_id)
select
  transfer.user_id,
  transfer.id,
  label.id
from public.transfers transfer
join public.labels label on label.user_id = transfer.user_id
where transfer.user_id = (select user_id from cashdeck_dev_seed_context)
  and label.name = case
    when transfer.destination_wallet_id = (
      select id from public.wallets where user_id = transfer.user_id and name = 'Spoření'
    ) then 'rezerva'
    when transfer.destination_wallet_id = (
      select id from public.wallets where user_id = transfer.user_id and name = 'Revolut'
    ) then 'cestovani'
    else 'auto'
  end;

insert into public.recurring_rules (
  user_id,
  name,
  kind,
  amount_czk,
  transaction_wallet_id,
  category_id,
  source_wallet_id,
  destination_wallet_id,
  note,
  frequency,
  custom_interval_days,
  schedule_anchor_date,
  next_occurrence_date,
  ends_on,
  status
)
select
  context.user_id,
  seed.name,
  seed.kind::public.recurring_rule_kind,
  seed.amount_czk,
  case when seed.transaction_wallet_name is null then null else (
    select id from public.wallets where user_id = context.user_id and name = seed.transaction_wallet_name
  ) end,
  case when seed.category_name is null then null else (
    select id
    from public.categories
    where user_id = context.user_id
      and name = seed.category_name
      and direction = seed.direction::public.money_direction
  ) end,
  case when seed.source_wallet_name is null then null else (
    select id from public.wallets where user_id = context.user_id and name = seed.source_wallet_name
  ) end,
  case when seed.destination_wallet_name is null then null else (
    select id from public.wallets where user_id = context.user_id and name = seed.destination_wallet_name
  ) end,
  seed.note,
  seed.frequency::public.recurring_frequency,
  seed.custom_interval_days::integer,
  current_date + seed.anchor_offset_days,
  current_date + seed.next_offset_days,
  case when seed.ends_offset_days is null then null else current_date + seed.ends_offset_days end,
  seed.status::public.recurring_rule_status
from cashdeck_dev_seed_context context
cross join (
  values
    ('Výplata', 'transaction', 58900::bigint, 'Běžný účet', 'Výplata', 'income', null, null, 'Pravidelná mzda', 'monthly', null, 4, 4, null, 'active'),
    ('Nájem', 'transaction', 17800::bigint, 'Běžný účet', 'Bydlení', 'expense', null, null, 'Platba nájmu', 'monthly', null, 5, 5, null, 'active'),
    ('Energie', 'transaction', 2650::bigint, 'Běžný účet', 'Bydlení', 'expense', null, null, 'Energie a služby', 'monthly', null, 7, 7, null, 'active'),
    ('Internet', 'transaction', 799::bigint, 'Běžný účet', 'Předplatné', 'expense', null, null, 'Internetové připojení', 'every_two_months', null, 9, 9, null, 'active'),
    ('Netflix', 'transaction', 239::bigint, 'Běžný účet', 'Předplatné', 'expense', null, null, 'Netflix předplatné', 'monthly', null, 12, 12, null, 'active'),
    ('Fitness', 'transaction', 1190::bigint, 'Běžný účet', 'Sport', 'expense', null, null, 'Měsíční členství', 'monthly', null, 15, 15, null, 'active'),
    ('Spoření', 'transfer', 20000::bigint, null, null, null, 'Běžný účet', 'Spoření', 'Pravidelná rezerva', 'monthly', null, 2, 2, null, 'active'),
    ('Revolut', 'transfer', 3500::bigint, null, null, null, 'Běžný účet', 'Revolut', 'Cestovní rozpočet', 'monthly', null, 3, 3, null, 'active'),
    ('Káva do práce', 'transaction', 150::bigint, 'Běžný účet', 'Restaurace', 'expense', null, null, 'Káva a snídaně', 'weekly', null, 1, 1, null, 'active'),
    ('HBO Max', 'transaction', 219::bigint, 'Běžný účet', 'Předplatné', 'expense', null, null, 'Ukončené předplatné', 'monthly', null, -240, -31, -60, 'ended')
) as seed(
  name,
  kind,
  amount_czk,
  transaction_wallet_name,
  category_name,
  direction,
  source_wallet_name,
  destination_wallet_name,
  note,
  frequency,
  custom_interval_days,
  anchor_offset_days,
  next_offset_days,
  ends_offset_days,
  status
);

insert into public.recurring_rule_labels (user_id, recurring_rule_id, label_id)
select
  rule.user_id,
  rule.id,
  label.id
from public.recurring_rules rule
join public.labels label on label.user_id = rule.user_id
join (
  values
    ('Výplata', 'prace'),
    ('Nájem', 'byt'),
    ('Energie', 'byt'),
    ('Internet', 'spotify'),
    ('Netflix', 'netflix'),
    ('Fitness', 'gym'),
    ('Spoření', 'rezerva'),
    ('Revolut', 'cestovani'),
    ('Káva do práce', 'kava'),
    ('HBO Max', 'netflix')
) as mapping(rule_name, label_name)
  on mapping.rule_name = rule.name
  and mapping.label_name = label.name
where rule.user_id = (select user_id from cashdeck_dev_seed_context);

update public.user_settings
set default_categories_seeded_at = now();

select
  (select count(*) from public.wallets) as wallets,
  (select count(*) from public.categories) as categories,
  (select count(*) from public.labels) as labels,
  (select count(*) from public.transactions) as transactions,
  (select count(*) from public.transfers) as transfers,
  (select count(*) from public.recurring_rules) as recurring_rules;

commit;
