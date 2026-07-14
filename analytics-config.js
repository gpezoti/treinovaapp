/*
 * Configuracao publica de analytics do Treinova.
 *
 * Para ativar, informe somente a Project API Key publica do PostHog. Nunca use
 * chaves pessoais, service role, OpenAI, Asaas ou qualquer outro secret aqui.
 * A captura continua dependendo do consentimento de cada usuario dentro do app.
 */
window.__TREINOVA_ANALYTICS_CONFIG__ = window.__TREINOVA_ANALYTICS_CONFIG__ || {
  posthogProjectKey: "",
  posthogHost: "https://us.i.posthog.com",
  enableHeatmaps: true,
  allowSessionReplay: true
};
