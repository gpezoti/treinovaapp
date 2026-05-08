-- Treinova: permite excluir um workout (modelo ou personalizado do aluno)
-- preservando o historico de sessoes do aluno.
-- Antes: FK NO ACTION bloqueava o delete com erro 23503
--   (sessions_workout_id_fkey on table sessions)
-- Agora: ON DELETE SET NULL — a sessao continua no historico com
-- workout_id NULL e workout_code/duration/total_volume_kg preservados.
-- Aplicada em 2026-05-07 via MCP.

alter table public.sessions
  drop constraint if exists sessions_workout_id_fkey;

alter table public.sessions
  add constraint sessions_workout_id_fkey
  foreign key (workout_id)
  references public.workouts(id)
  on delete set null;
