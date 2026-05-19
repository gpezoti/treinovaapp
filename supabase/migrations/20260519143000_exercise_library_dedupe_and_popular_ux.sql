-- Treinova - limpeza segura da biblioteca de exercicios
-- Objetivo: remover duplicidades exatas da biblioteca global sem afetar treinos ja montados.
-- Observacao: exercicios dentro de treinos sao copias com is_library = false, portanto nao sao apagados aqui.

begin;

with ranked as (
  select
    id,
    row_number() over (
      partition by lower(regexp_replace(trim(coalesce(name, '')), '\s+', ' ', 'g'))
      order by
        case when image_url is not null and image_url <> '' then 0 else 1 end,
        case when video_url is not null and video_url <> '' then 0 else 1 end,
        id
    ) as rn
  from public.exercises
  where is_library = true
    and coalesce(trim(name), '') <> ''
)
delete from public.exercises e
using ranked r
where e.id = r.id
  and r.rn > 1
  and e.is_library = true;

update public.exercises
set
  sets_count = 1,
  reps = 'Seguir período',
  pause = 'Seguir período'
where is_library = true
  and (
    sets_count is distinct from 1
    or coalesce(reps, '') <> 'Seguir período'
    or coalesce(pause, '') <> 'Seguir período'
  );

commit;
