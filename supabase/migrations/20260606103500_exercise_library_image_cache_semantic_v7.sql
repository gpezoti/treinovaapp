-- Bump exercise library image cache after anatomy correction for dumbbell bench press.
update public.exercises
set image_url = replace(image_url, '?v=20260606-semantic-v6', '?v=20260606-semantic-v7')
where is_library = true
  and image_url like '/assets/exercises/exact/%?v=20260606-semantic-v6';

