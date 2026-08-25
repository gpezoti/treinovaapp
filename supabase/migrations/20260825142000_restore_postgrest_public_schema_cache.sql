-- The Data API only serves application tables from public. Keep the schema list
-- explicit so PostgREST does not retain an unavailable schema in its cache.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
