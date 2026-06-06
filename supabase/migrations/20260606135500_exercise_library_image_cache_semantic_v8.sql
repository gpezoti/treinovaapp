update public.exercises
set image_url = replace(image_url, '?v=20260606-semantic-v7', '?v=20260606-semantic-v8')
where coalesce(is_library, false) = true
  and image_url like '/assets/exercises/exact/%?v=20260606-semantic-v7';
