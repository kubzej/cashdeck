/**
 * The `financial_events` CTE: every signed movement of money (opening balances, transactions,
 * transfers on each side, balance adjustments) for the wallets in a `wallet_scope` CTE, as
 * (event_date, delta_czk) rows. Overview and Independence both derive wealth from it, so it
 * lives in one place — two hand-kept copies had already drifted apart.
 *
 * The caller must define `wallet_scope (id, opening_balance_czk, opening_balance_date)` before
 * this fragment, and may bind `$1` to the user id. Each event counts from its wallet's opening
 * balance date onwards. Materialized: it scans the user's whole financial history, and the
 * queries built on it read it more than once.
 */
export const financialEventsCte = `financial_events as materialized (
    select opening_balance_date as event_date, opening_balance_czk::bigint as delta_czk
    from wallet_scope
    union all
    select t.transaction_date, case c.direction when 'income' then t.amount_czk else -t.amount_czk end
    from transactions t
    join wallet_scope w on w.id = t.wallet_id
    join categories c on c.user_id = t.user_id and c.id = t.category_id
    where t.user_id = $1 and t.transaction_date >= w.opening_balance_date
    union all
    select tr.transfer_date, -tr.amount_czk
    from transfers tr
    join wallet_scope w on w.id = tr.source_wallet_id
    where tr.user_id = $1 and tr.transfer_date >= w.opening_balance_date
    union all
    select tr.transfer_date, tr.amount_czk
    from transfers tr
    join wallet_scope w on w.id = tr.destination_wallet_id
    where tr.user_id = $1 and tr.transfer_date >= w.opening_balance_date
    union all
    select adjustment_date, case operation when 'add' then amount_czk else -amount_czk end
    from balance_adjustments adjustment
    join wallet_scope w on w.id = adjustment.wallet_id
    where adjustment.user_id = $1 and adjustment.adjustment_date >= w.opening_balance_date
  )`
