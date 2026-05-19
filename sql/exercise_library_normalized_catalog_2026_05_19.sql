-- Treinova - catalogo normalizado da biblioteca de exercicios
-- Data: 2026-05-19
-- Escopo seguro: altera apenas public.exercises where is_library = true.
-- Historico/treinos ja montados usam copias com is_library = false e nao sao renomeados/apagados aqui.

begin;

create or replace function pg_temp.treinova_exercise_key(value text)
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

create temp table _treinova_exercise_canonical (
  canonical_name text not null,
  cat text not null,
  muscle_group text not null,
  secondary_group text,
  equipment text,
  alias_key text primary key
) on commit drop;

with raw(canonical_name, cat, muscle_group, secondary_group, equipment, aliases) as (
values
  -- Peito
  ('Supino reto com barra', 'chest', 'Peito', 'Tríceps, Ombros', 'Barra', array['Supino reto', 'Supino reto barra', 'Supino com barra']),
  ('Supino reto com halteres', 'chest', 'Peito', 'Tríceps, Ombros', 'Halteres', array['Supino reto halteres']),
  ('Supino inclinado com barra', 'chest', 'Peito', 'Tríceps, Ombros', 'Barra', array['Supino inclinado barra']),
  ('Supino inclinado com halteres', 'chest', 'Peito', 'Tríceps, Ombros', 'Halteres', array['Supino inclinado halteres', 'Supino inclinado com halteres banco 30 graus']),
  ('Supino declinado com barra', 'chest', 'Peito', 'Tríceps, Ombros', 'Barra', array['Supino declinado']),
  ('Supino declinado com halteres', 'chest', 'Peito', 'Tríceps, Ombros', 'Halteres', array[]::text[]),
  ('Supino máquina convergente', 'chest', 'Peito', 'Tríceps, Ombros', 'Máquina', array['Chest press sentado', 'Supino reto articulado']),
  ('Crucifixo com halteres', 'chest', 'Peito', null, 'Halteres', array['Crucifixo reto', 'Crucifixo no banco plano']),
  ('Crucifixo inclinado com halteres', 'chest', 'Peito', null, 'Halteres', array['Crucifixo inclinado']),
  ('Crossover na polia alta', 'chest', 'Peito', null, 'Cabo', array['Crossover polia alta']),
  ('Crossover no cabo', 'chest', 'Peito', null, 'Cabo', array['Crossover no cabo cruzamento']),
  ('Peck deck', 'chest', 'Peito', null, 'Máquina', array['Peck deck fly na máquina', 'Peck deck (fly na máquina)']),
  ('Flexão de braços', 'chest', 'Peito', 'Tríceps, Ombros', 'Peso corporal', array['Flexão de braço']),
  ('Flexão de braços fechada', 'chest', 'Peito', 'Tríceps', 'Peso corporal', array['Flexão fechada', 'Flexão diamante']),

  -- Costas
  ('Barra fixa', 'back', 'Costas', 'Bíceps', 'Peso corporal', array['Barra fixa pullup', 'Barra fixa pegada pronada']),
  ('Barra fixa supinada', 'back', 'Costas', 'Bíceps', 'Peso corporal', array['Chin-up supinado', 'Barra fixa pegada supinada']),
  ('Puxada alta na polia', 'back', 'Costas', 'Bíceps', 'Cabo', array['Pulley frente pegada aberta', 'Puxada frontal pegada aberta', 'Puxada com barra pronada']),
  ('Puxada neutra na polia', 'back', 'Costas', 'Bíceps', 'Cabo', array['Puxada frontal pegada neutra', 'Pulley costas triângulo', 'Puxada com triângulo pegada neutra']),
  ('Puxada unilateral no cabo', 'back', 'Costas', 'Bíceps', 'Cabo', array[]::text[]),
  ('Pulldown braços retos', 'back', 'Costas', null, 'Cabo', array['Pulldown com corda', 'Pullover no cabo']),
  ('Remada curvada com barra', 'back', 'Costas', 'Bíceps', 'Barra', array['Remada curvada', 'Remada curvada pegada supinada']),
  ('Remada unilateral com halter', 'back', 'Costas', 'Bíceps', 'Halter', array['Serrote com halter', 'Remada curvada com halter unilateral']),
  ('Remada baixa', 'back', 'Costas', 'Bíceps', 'Cabo', array['Remada no cabo sentado', 'Remada baixa com triângulo', 'Remada baixa pegada neutra']),
  ('Remada cavalinho', 'back', 'Costas', 'Bíceps', 'Barra/Máquina', array['Remada cavalinho livre com triângulo', 'Remada cavalinho com apoio no peito']),
  ('Remada máquina articulada', 'back', 'Costas', 'Bíceps', 'Máquina', array['Remada máquina alta']),

  -- Ombros e trapezio
  ('Desenvolvimento com halteres', 'shoulder', 'Ombros', 'Tríceps', 'Halteres', array['Desenvolvimento unilateral com halter']),
  ('Desenvolvimento militar com barra', 'shoulder', 'Ombros', 'Tríceps', 'Barra', array['Desenvolvimento militar em pé', 'Desenvolvimento com barra']),
  ('Desenvolvimento na máquina', 'shoulder', 'Ombros', 'Tríceps', 'Máquina', array['Desenvolvimento articulado']),
  ('Desenvolvimento Arnold', 'shoulder', 'Ombros', 'Tríceps', 'Halteres', array['Arnold press', 'Press Arnold sentado']),
  ('Elevação lateral com halteres', 'shoulder', 'Ombros', null, 'Halteres', array['Elevação lateral', 'Elevação lateral com halter']),
  ('Elevação lateral no cabo', 'shoulder', 'Ombros', null, 'Cabo', array['Elevação lateral unilateral no cabo']),
  ('Elevação frontal com halteres', 'shoulder', 'Ombros', null, 'Halteres', array['Elevação frontal com halter']),
  ('Crucifixo inverso', 'shoulder', 'Ombros', 'Costas', 'Halteres/Cabo/Máquina', array['Crucifixo inverso com halteres', 'Crucifixo inverso na máquina', 'Crucifixo inverso no cabo']),
  ('Face pull no cabo', 'shoulder', 'Ombros', 'Trapézio', 'Cabo', array['Face pull', 'Face pull com duas cordas', 'Face pull sentado']),
  ('Remada alta com barra', 'trap', 'Trapézio', 'Ombros', 'Barra', array['Remada alta no cabo', 'Remada alta no smith']),
  ('Encolhimento com halteres', 'trap', 'Trapézio', null, 'Halteres', array['Encolhimento de ombros shrug']),
  ('Encolhimento com barra', 'trap', 'Trapézio', null, 'Barra', array[]::text[]),

  -- Bracos
  ('Rosca direta', 'biceps', 'Bíceps', null, 'Barra', array['Rosca direta com barra']),
  ('Rosca direta barra W', 'biceps', 'Bíceps', null, 'Barra W', array['Rosca 21 com barra W']),
  ('Rosca alternada com halteres', 'biceps', 'Bíceps', null, 'Halteres', array['Rosca alternada com halter', 'Rosca alternada']),
  ('Rosca martelo', 'biceps', 'Bíceps', 'Braquial', 'Halteres', array['Rosca martelo alternada']),
  ('Rosca Scott', 'biceps', 'Bíceps', null, 'Máquina/Banco Scott', array['Rosca scott na máquina', 'Rosca scott preacher curl', 'Rosca scott com halter']),
  ('Rosca concentrada', 'biceps', 'Bíceps', null, 'Halter', array['Rosca concentrada com halter']),
  ('Rosca na polia', 'biceps', 'Bíceps', null, 'Cabo', array['Rosca direta no cabo', 'Rosca direta na polia baixa', 'Rosca no cabo com barra W']),
  ('Rosca inclinada com halteres', 'biceps', 'Bíceps', null, 'Halteres', array['Rosca inclinada com halter']),
  ('Rosca inversa', 'biceps', 'Bíceps', 'Antebraço', 'Barra/Cabo', array['Rosca inversa com barra', 'Rosca inversa na polia']),
  ('Tríceps corda', 'triceps', 'Tríceps', null, 'Cabo', array['Tríceps corda no cabo']),
  ('Tríceps pulley', 'triceps', 'Tríceps', null, 'Cabo', array['Tríceps pulley com barra', 'Tríceps pulley com barra W']),
  ('Tríceps testa', 'triceps', 'Tríceps', null, 'Barra/Halteres', array['Tríceps testa com barra W', 'Tríceps testa com barra skullcrusher', 'Tríceps testa (skullcrusher)', 'Tríceps testa com halteres']),
  ('Tríceps francês', 'triceps', 'Tríceps', null, 'Halter/Cabo', array['Tríceps francês com halter', 'Tríceps francês sentado com halter', 'Tríceps francês com corda', 'Tríceps francês com corda na polia média']),
  ('Tríceps banco', 'triceps', 'Tríceps', 'Peito', 'Banco', array['Tríceps mergulho no banco']),
  ('Mergulho nas paralelas', 'triceps', 'Tríceps', 'Peito', 'Paralelas', array['Mergulho em paralelas dips', 'Paralela assistida para tríceps']),
  ('Tríceps coice', 'triceps', 'Tríceps', null, 'Halter/Cabo', array['Tríceps coice com halter', 'Tríceps coice bilateral', 'Kickback no cabo extensão de quadril']),

  -- Pernas
  ('Agachamento livre com barra', 'quad', 'Quadríceps', 'Glúteos', 'Barra', array['Agachamento livre']),
  ('Agachamento frontal', 'quad', 'Quadríceps', 'Core', 'Barra', array[]::text[]),
  ('Agachamento goblet', 'quad', 'Quadríceps', 'Glúteos', 'Halter/Kettlebell', array['Agachamento goblet com halter']),
  ('Agachamento sumô', 'quad', 'Quadríceps', 'Glúteos, Adutores', 'Barra/Halter', array['Agachamento sumô com halter', 'Sumô deadlift descalço']),
  ('Agachamento búlgaro', 'quad', 'Quadríceps', 'Glúteos', 'Halteres/Peso corporal', array['Agachamento búlgaro descalço', 'Agachamento split búlgaro com halteres']),
  ('Agachamento no Smith', 'quad', 'Quadríceps', 'Glúteos', 'Smith', array['Agachamento Smith']),
  ('Hack squat', 'quad', 'Quadríceps', 'Glúteos', 'Máquina', array['Hack squat máquina', 'Agachamento hack linear']),
  ('Leg press 45°', 'quad', 'Quadríceps', 'Glúteos', 'Máquina', array['Leg press 45 graus', 'Leg press']),
  ('Leg press unilateral', 'quad', 'Quadríceps', 'Glúteos', 'Máquina', array[]::text[]),
  ('Cadeira extensora', 'quad', 'Quadríceps', null, 'Máquina', array[]::text[]),
  ('Cadeira extensora unilateral', 'quad', 'Quadríceps', null, 'Máquina', array[]::text[]),
  ('Afundo', 'quad', 'Quadríceps', 'Glúteos', 'Halteres/Peso corporal', array['Afundo lunge', 'Avanço com halteres lunge']),
  ('Passada caminhando', 'quad', 'Quadríceps', 'Glúteos', 'Halteres/Peso corporal', array['Afundo caminhando', 'Avanço com halteres']),
  ('Mesa flexora', 'hamstring', 'Posterior de coxa', null, 'Máquina', array['Mesa flexora leg curl']),
  ('Mesa flexora unilateral', 'hamstring', 'Posterior de coxa', null, 'Máquina', array[]::text[]),
  ('Cadeira flexora', 'hamstring', 'Posterior de coxa', null, 'Máquina', array['Flexora sentado']),
  ('Cadeira flexora unilateral', 'hamstring', 'Posterior de coxa', null, 'Máquina', array[]::text[]),
  ('Stiff', 'hamstring', 'Posterior de coxa', 'Glúteos, Lombar', 'Barra/Halteres', array['Stiff com barra', 'Stiff terra romeno', 'RDL stiff com barra descalço']),
  ('Levantamento terra romeno', 'hamstring', 'Posterior de coxa', 'Glúteos, Lombar', 'Barra/Halteres', array['RDL com halteres', 'RDL unilateral', 'Levantamento terra romeno']),
  ('Flexora no cabo', 'hamstring', 'Posterior de coxa', null, 'Cabo', array['Flexora unilateral em pé']),
  ('Glute ham raise', 'hamstring', 'Posterior de coxa', 'Glúteos', 'Máquina/Peso corporal', array['Nordic curl assistido', 'Flexão nórdica nordic curl']),

  -- Gluteos, adutores, abdutores e panturrilhas
  ('Hip thrust', 'glute', 'Glúteos', 'Posterior de coxa', 'Barra/Máquina', array['Hip thrust com barra', 'Mesa hip thrust máquina', 'Elevação pélvica com barra']),
  ('Elevação pélvica no solo', 'glute', 'Glúteos', 'Posterior de coxa', 'Peso corporal', array['Ponte de glúteos com miniband']),
  ('Elevação pélvica unilateral', 'glute', 'Glúteos', 'Posterior de coxa', 'Peso corporal', array['Ponte unilateral de glúteos']),
  ('Glúteo no cabo', 'glute', 'Glúteos', null, 'Cabo', array['Glúteo no cabo kickback', 'Kickback no cabo', 'Coice no cabo']),
  ('Glúteo na máquina', 'glute', 'Glúteos', null, 'Máquina', array['Kickback máquina']),
  ('Glúteo quatro apoios', 'glute', 'Glúteos', null, 'Caneleira/Cabo', array['Donkey kicks', 'Donkey kicks no solo', 'Glúteo quatro apoios com caneleira']),
  ('Pull through no cabo', 'glute', 'Glúteos', 'Posterior de coxa', 'Cabo', array['Pull through foco glúteos']),
  ('Frog pump', 'glute', 'Glúteos', null, 'Peso corporal', array[]::text[]),
  ('Cadeira adutora', 'adductor', 'Adutores', null, 'Máquina', array['Adutora', 'Cadeira adutora + cadeira abdutora 90 graus']),
  ('Adutor no cabo', 'adductor', 'Adutores', null, 'Cabo', array['Adução de quadril no cabo']),
  ('Cossack squat', 'adductor', 'Adutores', 'Quadríceps, Mobilidade', 'Peso corporal/Halter', array[]::text[]),
  ('Frog stretch', 'adductor', 'Adutores', 'Mobilidade', 'Peso corporal', array['Mobilidade de adutores frog']),
  ('Cadeira abdutora', 'abductor', 'Abdutores', 'Glúteos', 'Máquina', array['Abdução de quadril na máquina']),
  ('Abdução de quadril no cabo', 'abductor', 'Abdutores', 'Glúteos', 'Cabo', array['Abdução de quadril na polia']),
  ('Abdução de quadril com elástico', 'abductor', 'Abdutores', 'Glúteos', 'Elástico', array['Caminhada lateral com miniband', 'Monster walk com miniband']),
  ('Panturrilha em pé', 'calf', 'Panturrilha', null, 'Máquina/Halteres', array['Panturrilha em pé na máquina', 'Panturrilha em pé com halteres']),
  ('Panturrilha sentada', 'calf', 'Panturrilha', null, 'Máquina', array['Panturrilha sentado']),
  ('Panturrilha no leg press', 'calf', 'Panturrilha', null, 'Máquina', array['Panturrilha no leg press 45 graus', 'Panturrilha no leg horizontal', 'Panturrilhas no leg horizontal']),
  ('Panturrilha unilateral', 'calf', 'Panturrilha', null, 'Peso corporal/Halter', array['Panturrilha unilateral no degrau', 'Panturrilha sentado unilateral']),
  ('Tibialis raise', 'calf', 'Panturrilha', 'Tibial anterior', 'Parede/Peso corporal', array['Tibialis raise na parede', 'Panturrilha tibial anterior']),

  -- Core, lombar, mobilidade e cardio
  ('Prancha', 'core', 'Abdômen', 'Core', 'Peso corporal', array['Prancha isométrica', 'Prancha plank']),
  ('Prancha lateral', 'core', 'Abdômen', 'Core', 'Peso corporal', array[]::text[]),
  ('Crunch abdominal', 'core', 'Abdômen', 'Core', 'Peso corporal', array['Abdominal supra crunch', 'Abdominal supra (crunch)']),
  ('Abdominal infra', 'core', 'Abdômen', 'Core', 'Peso corporal', array['Abdominal infra elevação de pernas']),
  ('Elevação de pernas', 'core', 'Abdômen', 'Core', 'Peso corporal/Paralela', array['Elevação de pernas deitado', 'Elevação de pernas na paralela']),
  ('Bicicleta abdominal', 'core', 'Abdômen', 'Core', 'Peso corporal', array[]::text[]),
  ('Pallof press', 'core', 'Abdômen', 'Core', 'Cabo/Elástico', array['Pallof press ajoelhado']),
  ('Russian twist', 'core', 'Abdômen', 'Core', 'Peso corporal/Halter', array['Russian twist com peso']),
  ('Ab wheel', 'core', 'Abdômen', 'Core', 'Roda abdominal', array['Ab wheel roda abdominal', 'Ab wheel rolinho abdominal']),
  ('Hiperextensão lombar', 'lowerback', 'Lombar', 'Glúteos, Posterior de coxa', 'Banco romano', array['Hiperextensão lombar no banco', 'Back extension foco posterior']),
  ('Good morning', 'lowerback', 'Lombar', 'Posterior de coxa', 'Barra', array['Bom dia good morning', 'Good morning com barra']),
  ('Levantamento terra convencional', 'lowerback', 'Lombar', 'Posterior de coxa, Glúteos', 'Barra', array['Levantamento terra']),
  ('Mobilidade torácica', 'mobility', 'Mobilidade', 'Coluna torácica', 'Peso corporal', array['Mobilidade torácica em quatro apoios', 'Rotação torácica']),
  ('Mobilidade de quadril 90/90', 'mobility', 'Mobilidade', 'Quadril', 'Peso corporal', array['Mobilidade de quadril 90/90 com troca', 'Abertura de quadril 90 90']),
  ('Mobilidade de tornozelo', 'mobility', 'Mobilidade', 'Tornozelo', 'Peso corporal', array['Mobilidade de tornozelo joelho na parede']),
  ('World greatest stretch', 'mobility', 'Mobilidade', 'Quadril, Torácica', 'Peso corporal', array['World greatest stretch com rotação']),
  ('Alongamento dinâmico', 'mobility', 'Mobilidade', null, 'Peso corporal', array['Deep squat passivo']),
  ('Caminhada', 'cardio', 'Aeróbio', null, 'Esteira/Rua', array['Caminhada ao ar livre']),
  ('Caminhada inclinada', 'cardio', 'Aeróbio', null, 'Esteira', array[]::text[]),
  ('Corrida', 'cardio', 'Aeróbio', null, 'Esteira/Rua', array['Corrida leve ao ar livre']),
  ('Corrida na esteira', 'cardio', 'Aeróbio', null, 'Esteira', array['Esteira intervalada', 'Esteira tiro curto']),
  ('Bike ergométrica', 'cardio', 'Aeróbio', null, 'Bicicleta', array['Bike zona 2/3', 'Bike ergométrica steady state']),
  ('Elíptico', 'cardio', 'Aeróbio', null, 'Elíptico', array['Elíptico intervalado']),
  ('Escada', 'cardio', 'Aeróbio', null, 'Escada/Step', array['Escada step', 'Escada ergométrica', 'Escada step machine']),
  ('Remo ergométrico', 'cardio', 'Aeróbio', null, 'Remo', array['Remo intervalado']),
  ('Corda naval', 'cardio', 'Aeróbio', 'Ombros, Core', 'Battle rope', array['Battle rope waves']),
  ('Pular corda', 'cardio', 'Aeróbio', null, 'Corda', array['Corda jump rope'])
),
expanded as (
  select
    r.canonical_name,
    r.cat,
    r.muscle_group,
    r.secondary_group,
    r.equipment,
    pg_temp.treinova_exercise_key(alias_name) as alias_key
  from raw r
  cross join lateral unnest(array_append(coalesce(r.aliases, array[]::text[]), r.canonical_name)) as alias_name
)
insert into _treinova_exercise_canonical (canonical_name, cat, muscle_group, secondary_group, equipment, alias_key)
select distinct on (alias_key)
  canonical_name,
  cat,
  muscle_group,
  secondary_group,
  equipment,
  alias_key
from expanded
where alias_key <> ''
order by alias_key, canonical_name;

-- Normaliza nomes/categorias de duplicidades e variacoes conhecidas.
update public.exercises e
set
  name = c.canonical_name,
  cat = c.cat,
  muscle_group = c.muscle_group,
  method = coalesce(nullif(e.method, ''), c.equipment),
  observations = case
    when c.secondary_group is null or coalesce(e.observations, '') ilike '%Grupo secundário:%'
      then coalesce(e.observations, '')
    else trim(concat_ws(' ', nullif(e.observations, ''), 'Grupo secundário: ' || c.secondary_group || '.'))
  end,
  sets_count = 1,
  reps = 'Seguir período',
  pause = 'Seguir período'
from _treinova_exercise_canonical c
where e.is_library = true
  and pg_temp.treinova_exercise_key(e.name) = c.alias_key;

-- Normaliza grupos legados que nao dependem do nome do exercicio.
update public.exercises
set muscle_group = case
  when lower(coalesce(muscle_group, '')) in ('peito', 'chest') then 'Peito'
  when lower(coalesce(muscle_group, '')) in ('costas', 'back') then 'Costas'
  when lower(coalesce(muscle_group, '')) in ('ombro', 'ombros', 'shoulder') then 'Ombros'
  when lower(coalesce(muscle_group, '')) in ('biceps', 'bíceps') then 'Bíceps'
  when lower(coalesce(muscle_group, '')) in ('triceps', 'tríceps') then 'Tríceps'
  when lower(coalesce(muscle_group, '')) in ('quadriceps', 'quadríceps', 'quad') then 'Quadríceps'
  when lower(coalesce(muscle_group, '')) in ('posterior', 'posterior de coxa', 'hamstring', 'isquiotibiais') then 'Posterior de coxa'
  when lower(coalesce(muscle_group, '')) in ('gluteo', 'glúteo', 'gluteos', 'glúteos') then 'Glúteos'
  when lower(coalesce(muscle_group, '')) in ('panturrilha', 'panturrilhas', 'calf') then 'Panturrilha'
  when lower(coalesce(muscle_group, '')) in ('abdomen', 'abdômen', 'core') then 'Abdômen'
  when lower(coalesce(muscle_group, '')) in ('lombar', 'lowerback', 'lower back') then 'Lombar'
  when lower(coalesce(muscle_group, '')) in ('trapezio', 'trapézio', 'trap') then 'Trapézio'
  when lower(coalesce(muscle_group, '')) in ('adutor', 'adutores', 'adductor') then 'Adutores'
  when lower(coalesce(muscle_group, '')) in ('abdutor', 'abdutores', 'abductor') then 'Abdutores'
  when lower(coalesce(muscle_group, '')) in ('mobilidade', 'mobility') then 'Mobilidade'
  when lower(coalesce(muscle_group, '')) in ('aerobio', 'aeróbio', 'cardio') then 'Aeróbio'
  else muscle_group
end
where is_library = true;

-- Ajusta categoria por grupo quando ainda veio vazia/legada.
update public.exercises
set cat = case muscle_group
  when 'Peito' then 'chest'
  when 'Costas' then 'back'
  when 'Ombros' then 'shoulder'
  when 'Bíceps' then 'biceps'
  when 'Tríceps' then 'triceps'
  when 'Quadríceps' then 'quad'
  when 'Posterior de coxa' then 'hamstring'
  when 'Glúteos' then 'glute'
  when 'Adutores' then 'adductor'
  when 'Abdutores' then 'abductor'
  when 'Panturrilha' then 'calf'
  when 'Abdômen' then 'core'
  when 'Lombar' then 'lowerback'
  when 'Trapézio' then 'trap'
  when 'Mobilidade' then 'mobility'
  when 'Aeróbio' then 'cardio'
  else cat
end
where is_library = true
  and (
    cat is null
    or cat = ''
    or cat in ('quadriceps', 'posterior', 'abdomen', 'aerobio', 'trapezio', 'abdutor', 'adutor')
  );

-- Insere exercicios comuns faltantes. O teste de existencia considera nome canonico e aliases.
with canonical_names as (
  select distinct canonical_name, cat, muscle_group, secondary_group, equipment
  from _treinova_exercise_canonical
)
insert into public.exercises
  (workout_id, student_id, position, name, cat, muscle_group, sets_count, reps, pause, cadence, method, observations, is_library, image_url)
select
  null,
  null,
  0,
  c.canonical_name,
  c.cat,
  c.muscle_group,
  1,
  'Seguir período',
  'Seguir período',
  '',
  c.equipment,
  trim(concat_ws(' ', 'Biblioteca Treinova normalizada.', case when c.secondary_group is not null then 'Grupo secundário: ' || c.secondary_group || '.' end)),
  true,
  null
from canonical_names c
where not exists (
  select 1
  from public.exercises e
  join _treinova_exercise_canonical a on a.alias_key = pg_temp.treinova_exercise_key(e.name)
  where e.is_library = true
    and a.canonical_name = c.canonical_name
);

-- Remove duplicidades exatas e as duplicidades que foram mapeadas para o mesmo nome canonico.
with ranked as (
  select
    id,
    row_number() over (
      partition by pg_temp.treinova_exercise_key(name)
      order by
        case when image_url is not null and image_url <> '' then 0 else 1 end,
        case when video_url is not null and video_url <> '' then 0 else 1 end,
        case when observations is not null and observations <> '' then 0 else 1 end,
        created_at nulls last,
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

-- Garante que biblioteca segue os parametros da periodizacao e tem grupo/categoria.
update public.exercises
set
  sets_count = 1,
  reps = 'Seguir período',
  pause = 'Seguir período',
  muscle_group = coalesce(nullif(muscle_group, ''), 'Mobilidade'),
  cat = coalesce(nullif(cat, ''), 'mobility')
where is_library = true;

commit;
