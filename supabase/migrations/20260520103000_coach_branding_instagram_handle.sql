-- Treinova beta: social handle used on workout share cards.
-- Stored on coach_branding because this belongs to the trainer's white-label identity.

alter table public.coach_branding
  add column if not exists instagram_handle text;

comment on column public.coach_branding.instagram_handle is
  'Instagram handle without @, used on generated feed/stories workout share cards.';
