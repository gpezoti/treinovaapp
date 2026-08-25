-- The Data API only serves application tables from public. Keep the schema list
-- explicit so PostgREST does not retain an unavailable schema in its cache.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public';
-- Keep catalog discovery from being cancelled before the schema cache is built.
alter role authenticator set statement_timeout = '30s';
alter role authenticator set lock_timeout = '10s';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
