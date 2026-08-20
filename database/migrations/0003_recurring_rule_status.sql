-- Explicit lifecycle for recurring rules after their final generated occurrence.
-- Apply manually in Neon Console as the schema owner after review.

begin;

create type public.recurring_rule_status as enum ('active', 'ended');

alter table public.recurring_rules
  add column status public.recurring_rule_status not null default 'active';

alter table public.recurring_rules
  drop constraint recurring_rules_end_is_not_before_next_occurrence,
  add constraint recurring_rules_status_matches_schedule
    check (
      (status = 'active' and (ends_on is null or next_occurrence_date <= ends_on))
      or (status = 'ended' and ends_on is not null and next_occurrence_date > ends_on)
    );

grant usage on type public.recurring_rule_status to cashdeck_app;

commit;
