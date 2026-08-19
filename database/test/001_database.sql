BEGIN;

SELECT plan(27);

SELECT has_table('public', 'wallets', 'wallets table exists');
SELECT has_table('public', 'transactions', 'transactions table exists');
SELECT has_table('public', 'transfers', 'transfers table exists');
SELECT has_table('public', 'balance_adjustments', 'balance adjustments table exists');
SELECT has_table('public', 'recurring_rules', 'recurring rules table exists');
SELECT col_type_is('public', 'transactions', 'amount_czk', 'bigint', 'transaction amounts use bigint');
SELECT col_type_is('public', 'transactions', 'transaction_date', 'date', 'transaction dates use date');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.wallets'::regclass), 'wallets have RLS enabled');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'user-a', true);

SELECT is((SELECT count(*)::integer FROM public.wallets), 3, 'user A sees all own wallets, including hidden');
SELECT is((SELECT count(*)::integer FROM public.transactions), 2, 'user A cannot see user B transactions');
SELECT is((SELECT count(*)::integer FROM public.transaction_labels), 1, 'user A sees own label joins');

SELECT throws_ok(
  $$INSERT INTO public.wallets (user_id, name, color_key) VALUES ('user-b', 'Forbidden', 'red')$$,
  '42501',
  NULL,
  'RLS blocks inserting another user row'
);

SELECT throws_ok(
  $$INSERT INTO public.transactions (user_id, wallet_id, category_id, direction, amount_czk, transaction_date)
    VALUES ('user-a', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000302', 'expense', 10, '2026-08-10')$$,
  '23514',
  NULL,
  'category direction must match transaction direction'
);

SELECT throws_ok(
  $$UPDATE public.categories SET direction = 'income' WHERE id = '00000000-0000-0000-0000-000000000301'$$,
  '42501',
  NULL,
  'category direction cannot change'
);

SELECT throws_ok(
  $$UPDATE public.wallets SET opening_balance_czk = 2000 WHERE id = '00000000-0000-0000-0000-000000000101'$$,
  '42501',
  NULL,
  'opening balance locks after first movement'
);

SELECT throws_ok(
  $$INSERT INTO public.transfers (user_id, source_wallet_id, destination_wallet_id, amount_czk, transfer_date)
    VALUES ('user-a', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000101', 1, '2026-08-10')$$,
  '23514',
  NULL,
  'transfer endpoints must differ'
);

SELECT throws_ok(
  $$INSERT INTO public.transactions (user_id, wallet_id, category_id, direction, amount_czk, transaction_date, recurring_rule_id, recurring_occurrence_date, recurring_name_snapshot)
    VALUES ('user-a', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', 'expense', 10, '2026-08-10', '00000000-0000-0000-0000-000000000701', '2026-08-10', 'Rent')$$,
  '42501',
  NULL,
  'ordinary writes cannot forge generated transaction fields'
);

SELECT throws_ok(
  $$INSERT INTO public.transactions (user_id, wallet_id, category_id, direction, amount_czk, transaction_date, recurring_rule_id, recurring_occurrence_date, recurring_name_snapshot)
    VALUES ('user-a', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', 'expense', 10, '2026-08-10', '00000000-0000-0000-0000-000000000701', '2026-08-11', 'Rent')$$,
  '42501',
  NULL,
  'ordinary writes cannot forge a second generated occurrence'
);

SELECT throws_ok(
  $$INSERT INTO public.transactions (user_id, wallet_id, category_id, direction, amount_czk, transaction_date)
    VALUES ('user-a', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000302', 'expense', 10, '2026-08-10')$$,
  '23514',
  NULL,
  'category direction is checked on every transaction'
);

SELECT lives_ok(
  $$SELECT public.seed_default_categories()$$,
  'default category seed function works for an authenticated user'
);
SELECT is((SELECT count(*)::integer FROM public.categories WHERE user_id = 'user-a'), 30, 'default categories are complete');
SELECT is((SELECT public.seed_default_categories()), 0, 'default category seed is idempotent');
SELECT is((SELECT count(*)::integer FROM public.categories WHERE user_id = 'user-a'), 30, 'idempotent seed does not duplicate categories');

SELECT lives_ok(
  $$DELETE FROM public.recurring_rules WHERE id = '00000000-0000-0000-0000-000000000701'$$,
  'deleting a recurring rule is allowed'
);
SELECT results_eq(
  $$SELECT recurring_rule_id, recurring_occurrence_date, recurring_name_snapshot
    FROM public.transactions
    WHERE id = '00000000-0000-0000-0000-000000001201'$$,
  $$VALUES (NULL::uuid, '2026-08-15'::date, 'Rent'::text)$$,
  'generated history keeps its occurrence snapshot after rule deletion'
);

SELECT lives_ok(
  $$DELETE FROM public.labels WHERE id = '00000000-0000-0000-0000-000000000501'$$,
  'user can delete own label'
);
SELECT is((SELECT count(*)::integer FROM public.transaction_labels WHERE transaction_id = '00000000-0000-0000-0000-000000000801'), 0, 'label deletion cascades associations');

SELECT finish();
ROLLBACK;
