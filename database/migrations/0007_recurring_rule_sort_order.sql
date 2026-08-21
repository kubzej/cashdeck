-- Manual sort order for recurring rules, mirroring wallets/categories.
-- Apply manually in Neon Console as the schema owner after review.

begin;

alter table public.recurring_rules
  add column sort_order integer not null default 0,
  add constraint recurring_rules_sort_order_non_negative check (sort_order >= 0);

create index recurring_rules_user_sort_order_idx
on public.recurring_rules (user_id, sort_order asc, id asc);

commit;
