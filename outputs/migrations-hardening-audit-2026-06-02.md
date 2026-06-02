# Treinova - P0-02 Migration/Hardening Audit

Data: 2026-06-02
Projeto Supabase: `mjftgknutxxgxhwlmsln`

## Objetivo

Reduzir drift entre o repositório local, SQLs auxiliares e o banco Supabase remoto, sem aplicar scripts antigos em lote e sem arriscar regressão nos fluxos de ADM MASTER, TREINADOR e ALUNO.

## Diagnóstico

O repositório tinha migrations locais que já estavam materializadas no Supabase, mas não apareciam no histórico remoto. Isso fazia um `supabase db push` futuro tentar reaplicar hardenings antigos.

Também havia duas RPCs de periodização em massa usadas pelo frontend, mas ausentes no remoto:

- `duplicate_periodization_week`
- `move_periodization_week`

Sem essas RPCs, o app caía no fallback client-side, aumentando o risco de atualização parcial em conexão instável.

## Checagem remota executada

Comando:

```bash
SUPABASE_NO_TELEMETRY=1 npx supabase@latest db query --linked --file /tmp/treinova_remote_hardening_checks.sql
```

Resultado final: todos os checks críticos retornaram `ok = true`.

Checks validados:

- migration anterior `20260602153000_harden_social_people_discovery`
- bucket público `branding`
- policy pública de leitura em `storage.objects` para branding
- índice único `coach_branding_coach_id_uidx`
- coluna `coach_branding.instagram_handle`
- tabela `coach_hidden_workouts`
- RPC `duplicate_periodization_week`
- RPC `move_periodization_week`
- colunas `exercises.sets_override` e `exercises.reps_override`
- coluna `sessions.exercise_overrides`
- função `is_payment_ok`
- índices de pagamentos Asaas
- coluna `periodization_blocks.workout_id`
- índice `periodization_blocks_workout_idx`
- RPC segura `save_my_coach_branding`

## Correção aplicada no banco remoto

Aplicada migration nova:

- `supabase/migrations/20260602170000_periodization_week_bulk_rpcs.sql`

Ela cria:

- `public.duplicate_periodization_week(p_student_id uuid, p_week_index integer)`
- `public.move_periodization_week(p_student_id uuid, p_week_index integer, p_dir integer)`

Decisão importante:

O SQL antigo em `sql/beta_periodization_week_management_2026_05_05.sql` não foi aplicado integralmente porque ele sobrescrevia a função `ensure_coach_owns_student` com uma regra antiga, removendo a permissão atual que permite o treinador editar a própria periodização. A migration nova reaproveita a função de permissão atual.

## Reparo de histórico de migrations

As migrations abaixo já tinham seus objetos presentes no Supabase, mas estavam sem registro no histórico remoto. Elas foram registradas em `supabase_migrations.schema_migrations` após validação objetiva dos objetos:

- `20260511150000_harden_payments_asaas`
- `20260512125000_restore_rls_payment_function_execute`
- `20260518193000_periodization_blocks_workout_binding`
- `20260520103000_coach_branding_instagram_handle`
- `20260525103000_coach_branding_logo_permissions`
- `20260525144500_save_my_coach_branding_rpc`
- `20260525150500_branding_storage_upload_api_compat`
- `20260526100000_manual_sets_reps_overrides`
- `20260602170000_periodization_week_bulk_rpcs`

Depois do reparo, `npx supabase@latest migration list` mostra essas versões alinhadas entre Local e Remote.

## SQLs soltos classificados como ja cobertos

Estes arquivos de `sql/` têm conteúdo idêntico a migrations oficiais locais/remotas:

- `sql/exercise_library_curated_2026_05_08.sql` -> `20260508170000_exercise_library_curated.sql`
- `sql/exercise_library_expanded_2026_05_08.sql` -> `20260508193000_exercise_library_expanded.sql`
- `sql/exercise_library_normalized_catalog_2026_05_19.sql` -> `20260519190000_exercise_library_normalized_catalog.sql`
- `sql/fix_admin_trainer_rpc_fallback_2026_05_07.sql` -> `20260507214500_fix_admin_trainer_rpc_fallback.sql`
- `sql/fix_beta_three_bugs_2026_05_08.sql` -> `20260508000100_fix_beta_three_bugs.sql`
- `sql/fix_flex_period_and_push_subscription_2026_05_08.sql` -> `20260508153000_fix_flex_period_and_push_subscription.sql`
- `sql/fix_profiles_rls_admin_trainer_2026_05_07.sql` -> `20260507213000_fix_profiles_rls_admin_trainer.sql`
- `sql/social_feed_coach_training_2026_05_08.sql` -> `20260508223000_social_feed_coach_training.sql`
- `sql/trainer_periodization_types_sets_2026_05_08.sql` -> `20260508143000_trainer_periodization_types_sets.sql`

## SQLs que devem continuar como referencia/legado

Nao aplicar em lote sem revalidacao:

- `sql/payments_complete.sql`: amplo demais e parcialmente substituido por migrations de trial, Asaas e platform access.
- `sql/beta_rls_hardening.sql`: antigo e parcialmente sobrescrito por hardenings posteriores.
- `sql/beta_security_audit_2026_05_05.sql`: referencia de auditoria, nao fonte atual de verdade.
- `sql/beta_workout_types_2026_05_05.sql`: fluxo evoluiu para presets/periodizacao atuais.
- `sql/rest_timer_push_jobs_2026_05_05.sql`: fluxo de push evoluiu em migrations e Edge Functions posteriores.
- `sql/native_push_tokens_2026_05_06.sql`: referencia antiga; validar contra implementacao atual antes de qualquer uso.
- `outputs/*.sql`: artefatos de apoio/diagnostico, nao devem ser tratados como migrations automaticamente.

## Estado atual de migrations

Ainda existem migrations remotas antigas sem arquivo local, criadas antes da pasta local de migrations estar consolidada. Elas aparecem como Remote-only no `migration list`. Nao foram revertidas nem recriadas nesta rodada para evitar risco em producao.

Recomendacao: manter como legado historico remoto por enquanto e, em uma rodada separada, gerar um baseline documentado se o time quiser zerar visualmente o drift antigo.

## Impacto por perfil

ADM MASTER:

- Menor risco de um push futuro reaplicar schema antigo.
- Historico remoto mais confiavel para auditoria.

TREINADOR:

- Duplicar e mover semanas de periodizacao passa a usar RPC atomica.
- Menos risco de periodizacao ficar parcialmente atualizada em internet instavel.
- Mantida permissao para o treinador editar a propria periodizacao.

ALUNO:

- Menor risco de receber periodizacao inconsistente quando o treinador reorganiza semanas.

## Criterios de aceite validados

- `duplicate_periodization_week` existe no remoto.
- `move_periodization_week` existe no remoto.
- As duas RPCs revogam execucao de `public` e `anon`.
- As duas RPCs concedem execucao somente a `authenticated`.
- As duas RPCs usam `ensure_coach_owns_student`.
- O historico remoto mostra as migrations locais recentes alinhadas.
- Nenhum SQL antigo foi aplicado em lote.

## Proximos passos recomendados

1. Fazer uma rodada separada para baseline das migrations remotas antigas sem arquivo local.
2. Remover ou mover SQLs legados para uma pasta `archive/` depois de validar que nao sao mais usados.
3. Criar smoke test de periodizacao com usuario real para duplicar, mover, remover e aplicar semanas em mobile.
