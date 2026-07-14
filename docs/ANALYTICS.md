# Analytics de produto

O Treinova usa PostHog para metricas de jornada, heatmaps e, quando o usuario
aceitar separadamente, reproducao tecnica de sessao. A integracao e opt-in:
sem consentimento ou sem chave publica configurada, nada e enviado.

## Ativar em producao

1. Crie um projeto no [PostHog Cloud](https://us.posthog.com/).
2. Em `Project settings > Project API Key`, copie a **Project API Key**.
   Essa chave e publica por natureza; nao use chave pessoal, token de API,
   service role do Supabase, chave do Asaas ou qualquer secret.
3. Edite `analytics-config.js` e preencha somente:

```js
posthogProjectKey: "phc_sua_chave_publica",
```

4. Mantenha `posthogHost` em `https://us.i.posthog.com` para um projeto US ou
   troque para a regiao exibida no painel do PostHog.
5. Publique o arquivo junto com o deploy do app.
6. Entre com uma conta de teste, aceite `Ativar metricas` em Perfil > Dados de
   uso e valide `Live events` no PostHog.

## Eventos de funil incluidos

- `account signed in`
- `trial signup completed`
- `student created`
- `trainer created`
- `workout started`
- `workout completed`
- `rest timer scheduled`
- `rest timer scheduling failed`
- `subscription checkout started`
- `subscription checkout failed`
- `screen viewed`

Os eventos carregam apenas papel, tela, origem, dispositivo e faixas de tempo
ou series. Nao carregam nomes, email, CPF, foto, mensagem, codigo do treino,
carga, URL de midia ou conteudo de formulario.

## Configuracoes recomendadas no PostHog

- Crie funis: `trial signup completed -> student created -> workout started -> workout completed`.
- Crie um segundo funil: `subscription checkout started -> pagamento confirmado`.
  A confirmacao de pagamento ainda deve entrar em um evento de backend quando
  o webhook do Asaas tiver uma fonte de verdade consolidada.
- Ative heatmaps apenas para usuarios que consentiram no app.
- Mantenha replay com mascaramento de texto, campos e imagens. O usuario pode
  desligar replay mantendo somente as metricas.
- Restrinja acesso ao projeto de analytics para a equipe responsavel pelo produto.

## Teste rapido

```bash
npm run qa:analytics
```

O teste protege a exigencia de consentimento, mascaramento e ausencia de PII
na identificacao e na conclusao do treino.
