INSERT INTO public.wallets (id, user_id, name, color_key, opening_balance_czk, opening_balance_date, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000101', 'user-a', 'Main', 'mint', 1000, '2026-01-01', 10),
  ('00000000-0000-0000-0000-000000000102', 'user-a', 'Savings', 'blue', 5000, '2026-01-01', 20),
  ('00000000-0000-0000-0000-000000000103', 'user-a', 'Hidden', 'gray', 250, '2026-01-01', 30),
  ('00000000-0000-0000-0000-000000000201', 'user-b', 'Main', 'mint', 2000, '2026-01-01', 10);

UPDATE public.wallets SET is_hidden = true
WHERE id = '00000000-0000-0000-0000-000000000103';

INSERT INTO public.categories (id, user_id, name, normalized_name, direction, icon_key, color_key, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000301', 'user-a', 'Jídlo', 'jídlo', 'expense', 'utensils', 'orange', 10),
  ('00000000-0000-0000-0000-000000000302', 'user-a', 'Výplata', 'výplata', 'income', 'wallet', 'green', 10),
  ('00000000-0000-0000-0000-000000000401', 'user-b', 'Jídlo', 'jídlo', 'expense', 'utensils', 'orange', 10);

INSERT INTO public.labels (id, user_id, name, normalized_name)
VALUES
  ('00000000-0000-0000-0000-000000000501', 'user-a', 'testlabel', 'testlabel'),
  ('00000000-0000-0000-0000-000000000601', 'user-b', 'testlabel', 'testlabel');

INSERT INTO public.recurring_rules (
  id, user_id, rule_type, name, amount_czk, wallet_id, category_id,
  recurrence_unit, recurrence_interval, anchor_day_of_month, next_occurrence_date
)
VALUES (
  '00000000-0000-0000-0000-000000000701', 'user-a', 'expense', 'Rent', 1200,
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000301',
  'month', 1, 15, '2026-09-15'
);

INSERT INTO public.transactions (
  id, user_id, wallet_id, category_id, direction, amount_czk, transaction_date, note,
  recurring_rule_id, recurring_occurrence_date, recurring_name_snapshot
)
VALUES
  ('00000000-0000-0000-0000-000000000801', 'user-a',
   '00000000-0000-0000-0000-000000000101',
   '00000000-0000-0000-0000-000000000301', 'expense', 100, '2026-08-01', 'Lunch', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-000000000901', 'user-b',
   '00000000-0000-0000-0000-000000000201',
   '00000000-0000-0000-0000-000000000401', 'expense', 75, '2026-08-01', 'Lunch', NULL, NULL, NULL),
  ('00000000-0000-0000-0000-000000001201', 'user-a',
   '00000000-0000-0000-0000-000000000101',
   '00000000-0000-0000-0000-000000000301', 'expense', 1200, '2026-08-15', 'Rent',
   '00000000-0000-0000-0000-000000000701', '2026-08-15', 'Rent');

INSERT INTO public.transfers (
  id, user_id, source_wallet_id, destination_wallet_id, amount_czk, transfer_date, note
)
VALUES (
  '00000000-0000-0000-0000-000000001001', 'user-a',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000102', 250, '2026-08-02', 'Savings');

INSERT INTO public.balance_adjustments (
  id, user_id, wallet_id, amount_czk, operation, adjustment_date, note
)
VALUES (
  '00000000-0000-0000-0000-000000001101', 'user-a',
  '00000000-0000-0000-0000-000000000101', 10, 'add', '2026-08-03', 'Reconcile');

INSERT INTO public.transaction_labels (user_id, transaction_id, label_id)
VALUES ('user-a', '00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000501');
