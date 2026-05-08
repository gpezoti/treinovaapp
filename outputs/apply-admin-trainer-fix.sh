#!/bin/zsh
set -euo pipefail

cd "/Users/guilhermepezoti/Documents/Treinova - cópia"

supabase link --project-ref mjftgknutxxgxhwlmsln
supabase db push
supabase functions deploy admin-user
