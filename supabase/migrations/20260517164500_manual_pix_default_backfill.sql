-- =============================================================================
-- Treinova - PIX manual como padrão temporário dos treinadores
-- 2026-05-17
--
-- Mantém histórico e preenche lançamentos abertos já existentes quando o
-- treinador já cadastrou chave PIX manual. Não remove dados Asaas antigos.
-- =============================================================================

update public.trainer_payment_accounts
set is_default = false
where provider <> 'manual_pix'
  and is_default = true;

update public.trainer_payment_accounts
set is_default = true
where provider = 'manual_pix'
  and nullif(trim(coalesce(pix_key, '')), '') is not null;

update public.payments p
set
  payment_provider = 'manual_pix',
  provider_public_payload = jsonb_build_object(
    'pix_key', a.pix_key,
    'pix_key_type', coalesce(a.pix_key_type, ''),
    'display_name', coalesce(a.display_name, '')
  )
from public.trainer_payment_accounts a
where p.receiver_id = a.trainer_id
  and a.provider = 'manual_pix'
  and a.is_default = true
  and nullif(trim(coalesce(a.pix_key, '')), '') is not null
  and p.status in ('pending', 'overdue')
  and (
    p.payment_provider is null
    or p.payment_provider = ''
    or p.payment_provider = 'manual_pix'
  );
