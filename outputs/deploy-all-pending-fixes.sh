#!/bin/zsh
set -euo pipefail

cd "/Users/guilhermepezoti/Documents/Treinova - cópia"

if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CLI=(supabase)
else
  SUPABASE_CLI=(npx supabase)
fi

set -a
source "outputs/vapid-rest-timer-2026-05-07.env"
set +a

"${SUPABASE_CLI[@]}" link --project-ref mjftgknutxxgxhwlmsln
"${SUPABASE_CLI[@]}" secrets set \
  VAPID_PUBLIC_KEY="$VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="$VAPID_PRIVATE_KEY" \
  VAPID_SUBJECT="$VAPID_SUBJECT"
"${SUPABASE_CLI[@]}" db query --linked --file sql/fix_profiles_rls_admin_trainer_2026_05_07.sql
"${SUPABASE_CLI[@]}" db query --linked --file sql/fix_admin_trainer_rpc_fallback_2026_05_07.sql
"${SUPABASE_CLI[@]}" db query --linked --file sql/fix_beta_three_bugs_2026_05_08.sql
"${SUPABASE_CLI[@]}" functions deploy rest-timer-push
"${SUPABASE_CLI[@]}" functions deploy admin-user
"${SUPABASE_CLI[@]}" functions list

echo ""
echo "Deploy concluido. Confirme na lista acima:"
echo "- admin-user"
echo "- rest-timer-push"
echo ""
echo "Depois recarregue o app no iPhone antes de testar novamente."
