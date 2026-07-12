-- Treinova beta: limpeza segura de duplicados da biblioteca de exercicios.
-- Escopo:
-- - Remove somente linhas de biblioteca (is_library = true).
-- - Nunca remove exercicios de treinos reais (workout_id is not null).
-- - Preserva o melhor registro por nome normalizado, priorizando midia e conteudo.
-- Contexto de schema:
-- Exercicios adicionados a treinos sao copias com is_library = false; a biblioteca
-- funciona como catalogo reutilizavel e nao deve carregar duplicidades visiveis.

begin;

create or replace function pg_temp.treinova_exercise_duplicate_key(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      lower(coalesce(value, '')),
      'áàâãäåéèêëíìîïóòôõöúùûüçñºª°()',
      'aaaaaaeeeeiiiiooooouuuucnoao   '
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

with ranked_library as (
  select
    id,
    pg_temp.treinova_exercise_duplicate_key(name) as exercise_key,
    row_number() over (
      partition by pg_temp.treinova_exercise_duplicate_key(name)
      order by
        case when image_url is not null and image_url <> '' then 0 else 1 end,
        case when video_url is not null and video_url <> '' then 0 else 1 end,
        case when observations is not null and observations <> '' then 0 else 1 end,
        case when method is not null and method <> '' then 0 else 1 end,
        created_at nulls last,
        id
    ) as rn
  from public.exercises
  where is_library = true
    and workout_id is null
    and coalesce(trim(name), '') <> ''
),
delete_candidates as (
  select id
  from ranked_library
  where rn > 1
    and exercise_key <> ''
)
delete from public.exercises e
using delete_candidates c
where e.id = c.id
  and e.is_library = true
  and e.workout_id is null;

commit;
