-- The minute-level worker is required for backgrounded PWAs, but invoking the
-- Edge Function with no due timer creates unnecessary pg_net writes and HTTP
-- response churn. Preserve the existing credentials while gating the call on
-- actual work in the indexed scheduled-job queue.
do $$
declare
  worker_job_id bigint;
  worker_command text;
  rewritten_command text;
  net_prune_job_id bigint;
begin
  select jobid, command
  into worker_job_id, worker_command
  from cron.job
  where jobname = 'treinova-rest-timer-push-every-minute'
  limit 1;

  if worker_job_id is not null
    and position('where exists' in lower(worker_command)) = 0 then
    rewritten_command := regexp_replace(worker_command, E';[[:space:]]*$', '');
    rewritten_command := regexp_replace(
      rewritten_command,
      E'^[[:space:]]*select[[:space:]]+',
      'select (',
      'i'
    );

    if left(ltrim(rewritten_command), 8) <> 'select (' then
      raise exception 'Unexpected rest timer cron command format';
    end if;

    rewritten_command := rewritten_command || $conditional$
) where exists (
  select 1
  from public.rest_timer_push_jobs
  where status = 'scheduled'
    and fire_at <= now()
);
$conditional$;

    perform cron.alter_job(
      job_id => worker_job_id,
      command => rewritten_command
    );
  end if;

  -- pg_net already expires responses according to its configured TTL. The
  -- duplicate daily DELETE scanned the response table and added avoidable I/O.
  select jobid
  into net_prune_job_id
  from cron.job
  where jobname = 'prune_net_http'
  limit 1;

  if net_prune_job_id is not null then
    perform cron.unschedule(net_prune_job_id);
  end if;
end;
$$;
