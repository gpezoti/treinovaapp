-- Hardening da integração Asaas para produção.
-- Mantém schema existente e adiciona apenas índices seguros para lookup/idempotência.

create unique index if not exists payments_asaas_id_unique_idx
  on public.payments (asaas_id)
  where asaas_id is not null;

create index if not exists payments_external_reference_idx
  on public.payments (external_reference)
  where external_reference is not null;

