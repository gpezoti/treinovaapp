#!/bin/zsh
set -euo pipefail

cd "/Users/guilhermepezoti/Documents/Treinova - cópia"
set -a
source "outputs/vapid-rest-timer-2026-05-07.env"
set +a

supabase link --project-ref mjftgknutxxgxhwlmsln
supabase secrets set \
  VAPID_PUBLIC_KEY="$VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="$VAPID_PRIVATE_KEY" \
  VAPID_SUBJECT="$VAPID_SUBJECT"
supabase functions deploy rest-timer-push
