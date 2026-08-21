-- Balance adjustments never exposed a note field in the API/UI; drop the unused column.
-- Apply manually in Neon Console as the schema owner after review.

begin;

alter table public.balance_adjustments
  drop constraint balance_adjustments_note_trimmed_and_not_blank;

alter table public.balance_adjustments
  drop column note;

commit;
