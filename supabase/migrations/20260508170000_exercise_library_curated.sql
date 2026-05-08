-- Treinova - biblioteca curada de exercícios por grupo muscular
-- Data: 2026-05-08
-- Fontes de taxonomia/organização consultadas: ACE Exercise Library, ExRx Exercise Directory e NASM Exercise Library.
-- Objetivo: enriquecer a biblioteca do professor sem gravar séries/reps/pausa no exercício.

begin;

with seed(name, cat, muscle_group, method, observations) as (
values
  ('Mobilidade rotacional de ombros com bastão ou corda', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Mobilidade rotacional de tronco na parede', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Prancha isométrica + Super-man no solo', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Rotação cubana com halteres em pé', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Face pull (com duas cordas)', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Remada cavalinho livre com triângulo', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Barra fixa supinada + Pulldown com corda', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Puxada frontal com barra (pegada neutra)', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca concentrada com halter', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca scott na máquina', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Mobilidade de posteriores no solo (unilateral)', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Mobilidade de adutores frog no solo', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Flexão de quadril na paralela com joelho estendido', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Cadeira adutora + Cadeira abdutora 90°', 'adductor', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Sumô deadlift descalço', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Agachamento búlgaro descalço', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Agachamento hack linear', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Cadeira extensora', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Panturrilhas no leg horizontal', 'calf', 'Panturrilha', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Prancha isométrica + Abdominal supra 90°', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Supino inclinado com halteres (banco 30°)', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Crucifixo no cross over polia baixa, banco inclinado 45°', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Supino reto articulado', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Desenvolvimento articulado + Elevação lateral c/ halteres', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Tríceps pulley com barra W', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Tríceps francês com corda na polia média', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Extensão de quadril no banco romano', 'core', 'Abdômen', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Flexora unilateral em pé', 'core', 'Abdômen', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Cadeira flexora', 'hamstring', 'Posterior', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('RDL (stiff) com barra descalço', 'hamstring', 'Posterior', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Panturrilhas no Smith', 'calf', 'Panturrilha', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Mobilidade rotacional de ombros', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Mobilidade de posteriores (unilateral)', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Mobilidade de adutores frog', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Bike Zona 2/3', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Supino Reto com Barra', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Supino Inclinado com Barra', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Supino Declinado com Barra', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Supino Reto com Halteres', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Supino Inclinado com Halteres', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Crucifixo Reto', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Crucifixo Inclinado', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Crossover no Cabo', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Peck Deck (Fly na Máquina)', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Flexão de Braços', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Flexão Inclinada (pés altos)', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Pullover com Halter', 'chest', 'Peito', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Barra Fixa (Pullup)', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Remada Curvada com Barra', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Remada Unilateral com Halter', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Remada Cavalinho', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Remada no Cabo Sentado', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Pulley Costas (Triângulo)', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Pulley Frente (Pegada Aberta)', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Puxada com Barra Pronada', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Levantamento Terra', 'core', 'Abdômen', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Hiperextensão Lombar', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Serrote com Halter', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Remada Alta no Cabo', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Desenvolvimento com Barra', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Desenvolvimento com Halteres', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Elevação Lateral com Halter', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Elevação Frontal com Halter', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Elevação Lateral no Cabo', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Desenvolvimento Arnold', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Remada Alta com Barra', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Encolhimento com Barra', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Encolhimento com Halteres', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Face Pull no Cabo', 'back', 'Costas', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rotação Externa com Elástico', 'shoulder', 'Ombros', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca Direta com Barra', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca Alternada com Halter', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca Concentrada', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca Martelo', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca no Cabo com Barra W', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca Scott (Preacher Curl)', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca Inclinada com Halter', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca 21', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Rosca Inversa', 'biceps', 'Bíceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Tríceps Testa (Skullcrusher)', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Tríceps Corda no Cabo', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Tríceps Pulley com Barra', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Tríceps Francês com Halter', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Mergulho em Paralelas (Dips)', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Supino Fechado', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Tríceps Coice com Halter', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Tríceps Testa no Cabo', 'triceps', 'Tríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Agachamento Livre com Barra', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Agachamento Goblet', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Leg Press 45°', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Avanço com Halteres', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Avanço com Barra', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Agachamento Búlgaro', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Agachamento Sumô', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Hack Squat', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Afundo no Smith', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Mesa Flexora', 'hamstring', 'Posterior', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Stiff (Terra Romeno)', 'hamstring', 'Posterior', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Flexão Nórdica (Nordic Curl)', 'hamstring', 'Posterior', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Good Morning', 'hamstring', 'Posterior', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Levantamento Terra Romeno', 'hamstring', 'Posterior', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Hip Thrust', 'glute', 'Glúteos', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Hip Thrust com Barra', 'glute', 'Glúteos', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Glúteo no Cabo (Kickback)', 'glute', 'Glúteos', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Agachamento Sumô Profundo', 'quad', 'Quadríceps', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Abdução de Quadril com Elástico', 'glute', 'Glúteos', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Mesa Hip Thrust (máquina)', 'glute', 'Glúteos', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Elevação Pélvica no Solo', 'glute', 'Glúteos', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Passada Lateral', 'glute', 'Glúteos', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Donkey Kicks', 'glute', 'Glúteos', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Panturrilha em Pé na Máquina', 'calf', 'Panturrilha', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Panturrilha Sentado', 'calf', 'Panturrilha', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Panturrilha Livre (Bilateral)', 'calf', 'Panturrilha', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Panturrilha Unilateral', 'calf', 'Panturrilha', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Leg Press (foco panturrilha)', 'calf', 'Panturrilha', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Prancha (Plank)', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Crunch Abdominal', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Elevação de Pernas Deitado', 'core', 'Abdômen', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Abdominal Infra na Barra', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Russian Twist', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Prancha Lateral', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Bicicleta Abdominal', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Dead Bug', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Ab Wheel (Roda Abdominal)', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Vácuo Abdominal', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Crunch Oblíquo', 'core', 'Abdômen', 'Séries múltiplas', 'Imagem realista padrão incluída no app.'),
  ('Mountain Climber', 'core', 'Abdômen', 'Core', 'Imagem realista padrão incluída no app.'),
  ('Alongamento de Quadríceps', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Alongamento de Isquiotibiais', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Mobilidade de Tornozelo', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Cat-Cow (Mobilidade Lombar)', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Abertura de Quadril 90/90', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('World Greatest Stretch', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Dislocação de Ombros (bastão)', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Deep Squat Passivo', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Rotação Torácica', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Hip Circles', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Pigeon Pose', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Frog Stretch', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Scorpion Stretch', 'mobility', 'Mobilidade', 'Mobilidade', 'Imagem realista padrão incluída no app.'),
  ('Corrida na Esteira', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Caminhada Inclinada', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('HIIT na Esteira', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Bike Ergométrica', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Spinning', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Elíptico', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Corda (Jump Rope)', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Escada (Step)', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Remo Ergométrico', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.'),
  ('Burpees', 'cardio', 'Aeróbio', 'Condicionamento', 'Imagem realista padrão incluída no app.')
)
insert into public.exercises
  (workout_id, student_id, position, name, cat, muscle_group, sets_count, reps, pause, cadence, method, observations, is_library, image_url)
select
  null,
  null,
  0,
  s.name,
  s.cat,
  s.muscle_group,
  1,
  'Seguir período',
  'Seguir período',
  '',
  s.method,
  s.observations,
  true,
  null
from seed s
where not exists (
  select 1
  from public.exercises e
  where e.is_library = true
    and lower(e.name) = lower(s.name)
);

update public.exercises
set
  sets_count = 1,
  reps = 'Seguir período',
  pause = 'Seguir período'
where is_library = true;

update public.exercises
set muscle_group = case
  when lower(muscle_group) in ('peito') then 'Peito'
  when lower(muscle_group) in ('costas') then 'Costas'
  when lower(muscle_group) in ('ombro', 'ombros') then 'Ombros'
  when lower(muscle_group) in ('biceps', 'bíceps') then 'Bíceps'
  when lower(muscle_group) in ('triceps', 'tríceps') then 'Tríceps'
  when lower(muscle_group) in ('quadriceps', 'quadríceps') then 'Quadríceps'
  when lower(muscle_group) in ('posterior') then 'Posterior'
  when lower(muscle_group) in ('gluteo', 'glúteo', 'gluteos', 'glúteos') then 'Glúteos'
  when lower(muscle_group) in ('panturrilha') then 'Panturrilha'
  when lower(muscle_group) in ('abdomen', 'abdômen') then 'Abdômen'
  when lower(muscle_group) in ('mobilidade') then 'Mobilidade'
  when lower(muscle_group) in ('aerobio', 'aeróbio') then 'Aeróbio'
  else muscle_group
end
where is_library = true;

commit;
