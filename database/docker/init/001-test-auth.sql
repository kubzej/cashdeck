CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE EXTENSION IF NOT EXISTS pgtap;

CREATE OR REPLACE FUNCTION auth.user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '');
$$;

GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.user_id() TO authenticated;
