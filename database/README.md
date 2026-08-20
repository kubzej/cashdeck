# Cashdeck Database Migrations

Cashdeck uses ordered, manual PostgreSQL migrations. The Cashdeck API connects
only as the restricted `cashdeck_app` role; it never applies schema changes.

## Workflow

1. Review the next numbered SQL file in `database/migrations/`.
2. Back up or inspect the target Neon branch as appropriate for the change.
3. In Neon Console, connect as the schema owner and paste the complete SQL
   file into the SQL Editor.
4. Run the file once and inspect the Console result before moving on.
5. Record the reviewed and applied migration in the associated Git change or
   pull request. Neon Console query history remains the operational record.

## Applied Migrations

| Migration | Neon branch | Applied |
| --- | --- | --- |
| `0001_initial_schema.sql` | `production` | 2026-08-20 |

## Rules

- Migrations are ordered as `NNNN_short_description.sql`.
- Never edit a migration after it has been applied. Add a new forward migration
  for every schema correction.
- Do not add database URLs, credentials, a migration runner, or a CI database
  job to this repository.
- Prepare rollback as a separately reviewed forward migration. Do not attempt
  an unreviewed destructive rollback directly in production.
