-- Treinova: coach pode excluir qualquer treino da lista (modelos globais
-- criados por outro coach/admin), nao apenas os que ele mesmo criou.
-- A FK sessions.workout_id ja esta em ON DELETE SET NULL, entao o
-- historico do aluno fica preservado.
-- Aplicada em 2026-05-07 via MCP.

drop policy if exists "workouts coach delete own" on public.workouts;
drop policy if exists "workouts coach delete any" on public.workouts;

create policy "workouts coach delete any"
  on public.workouts
  for delete
  to authenticated
  using (public.is_coach((select auth.uid())));
