# Edge Functions — Treinova

Coloque essas pastas em `supabase/functions/` no seu repositório.

## Pré-requisitos
1. Instalar Supabase CLI (`brew install supabase/tap/supabase`)
2. Fazer login: `supabase login`
3. Linkar projeto: `supabase link --project-ref mjftgknutxxgxhwlmsln`

## Estrutura esperada
```
supabase/
  functions/
    asaas-create-charge/index.ts
    asaas-webhook/index.ts
    send-push/index.ts
```

## Secrets (rodar UMA vez)

### Asaas
```bash
supabase secrets set \
  ASAAS_API_KEY="sua-api-key-do-asaas" \
  ASAAS_BASE_URL="https://sandbox.asaas.com/api/v3" \
  ASAAS_WEBHOOK_TOKEN="um-token-aleatorio-grande"
```
Para produção, use `https://api.asaas.com/v3`.

### Push (gere VAPID keys ANTES)
```bash
# instale web-push CLI: npm i -g web-push
web-push generate-vapid-keys

# resultado: public e private keys
supabase secrets set \
  VAPID_PUBLIC_KEY="BHa..." \
  VAPID_PRIVATE_KEY="abc..." \
  VAPID_SUBJECT="mailto:suporte@treinovaapp.com"
```

Depois cole a `VAPID_PUBLIC_KEY` no `index.html` antes do `<script>` do app:
```html
<script>window.VAPID_PUBLIC_KEY = "BHa...";</script>
```

## Deploy
```bash
supabase functions deploy asaas-create-charge
supabase functions deploy asaas-webhook --no-verify-jwt
supabase functions deploy send-push
```

> `--no-verify-jwt` no webhook porque o Asaas não envia JWT do Supabase.

## Configurar webhook no Asaas
- Painel Asaas → Integrações → Webhooks → Adicionar
- URL: `https://mjftgknutxxgxhwlmsln.supabase.co/functions/v1/asaas-webhook`
- Header opcional: `asaas-access-token: <ASAAS_WEBHOOK_TOKEN>`
- Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_REFUNDED`

## Testar push manualmente
```js
// no console do app, logado como admin/coach:
const { data } = await sb.functions.invoke("send-push", {
  body: { user_ids: ["<user-id>"], title: "Olá!", body: "Teste de push", url: "/" }
});
console.log(data);
```

## Cron de cobrança (opcional, automatiza envio diário)
Crie em Supabase Dashboard → Database → Cron jobs:
```sql
select cron.schedule(
  'asaas-daily-overdue',
  '0 9 * * *',  -- 09h Brasília (UTC-3 = 12h UTC)
  $$
    -- chama send-push pra alunos atrasados
    select net.http_post(
      url := 'https://mjftgknutxxgxhwlmsln.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type','application/json'),
      body := jsonb_build_object(
        'user_ids', (select coalesce(jsonb_agg(user_id),'[]'::jsonb) from public.payments where status='overdue'),
        'title', 'Pagamento atrasado',
        'body', 'Você tem uma mensalidade em aberto. Toque pra ver.',
        'url', '/'
      )
    );
  $$
);
```
