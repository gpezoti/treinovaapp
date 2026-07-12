-- Treinova beta: renova cache das imagens de exercicios apos revisao semantica.
-- Data: 2026-06-05
-- Seguro/idempotente: atualiza apenas URLs locais da biblioteca global.

begin;

update public.exercises
set image_url = replace(image_url, '?v=20260605-specific-v2', '?v=20260605-semantic-v3')
where is_library = true
  and image_url like '/assets/exercises/exact/%?v=20260605-specific-v2';

commit;
