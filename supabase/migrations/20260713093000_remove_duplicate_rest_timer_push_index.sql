-- O indice parcial de jobs agendados ja existe na migration original.
-- Remove a copia criada durante o endurecimento de idempotencia.

drop index if exists public.idx_rest_timer_push_jobs_due_claim;
