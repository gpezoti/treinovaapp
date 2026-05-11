import fs from "node:fs";

const html = fs.readFileSync("index.html", "utf8");

const checks = [
  {
    name: "atalhos rapidos do professor na lista de alunos",
    pass: html.includes("teacher-toolbar") &&
      html.includes("Adicionar aluno") &&
      html.includes("Compartilhar link") &&
      html.includes("Ver inadimplentes"),
  },
  {
    name: "campos e botoes com alvo de toque adequado no mobile",
    pass: html.includes("min-height: 46px") &&
      html.includes("-webkit-tap-highlight-color: transparent") &&
      html.includes("font-size: 16px"),
  },
  {
    name: "aluno recebe orientacao antes da lista de exercicios",
    pass: html.includes("Exercícios do treino") &&
      html.includes("Toque em um exercício para abrir séries, carga, descanso e instruções."),
  },
  {
    name: "barra fixa de treino mostra feedback de progresso",
    pass: html.includes("wfb-hint") &&
      html.includes("Pode concluir a qualquer hora") &&
      html.includes("Progresso salvo") &&
      html.includes("Pronto para finalizar"),
  },
  {
    name: "editor do professor tem estado vazio acionavel",
    pass: html.includes("Treino vazio") &&
      html.includes("Adicione o primeiro exercício para montar a sequência do aluno."),
  },
  {
    name: "novo aluno tem microcopy de primeiro acesso",
    pass: html.includes("o aluno será orientado a trocar a senha no primeiro acesso"),
  },
  {
    name: "estado vazio de alunos explica proximas acoes",
    pass: html.includes("Adicione um aluno ou compartilhe o link de cadastro."),
  },
  {
    name: "erros tecnicos sao convertidos em mensagens acionaveis",
    pass: html.includes("function userFacingErrorMessage(msg)") &&
      html.includes("kind === \"error\" ? userFacingErrorMessage(msg) : msg") &&
      html.includes("Serviço temporariamente indisponível. Tente novamente em instantes.") &&
      !html.includes("<small>${escapeHtml(error.message||'')}</small>"),
  },
];

const failed = checks.filter((check) => !check.pass);

for (const check of checks) {
  console.log(`${check.pass ? "OK" : "FAIL"} - ${check.name}`);
}

if (failed.length) {
  console.error(`\n${failed.length} UX polish check(s) failed.`);
  process.exit(1);
}

console.log("\nAll UI polish checks passed.");
