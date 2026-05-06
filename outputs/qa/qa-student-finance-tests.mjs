import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /function paymentEffectiveStatus\(p\)/, "student finance should normalize payment status");
assert.match(html, /async function renderStudentFinance\(el\)/, "student finance renderer should exist");
assert.match(html, /loadMyPayments\(\{ throwOnError: true \}\)/, "student finance should expose loading errors");
assert.match(html, /\.eq\("user_id", STATE\.profile\.id\)/, "student finance must query only the logged-in student's payments");
assert.match(html, /Total pendente/, "summary should include total pending amount");
assert.match(html, /Próximo vencimento/, "summary should include next due date");
assert.match(html, /Pagamentos em atraso/, "summary should include overdue payments");
assert.match(html, /Último pagamento/, "summary should include last payment");
assert.match(html, /Pendentes e vencimentos/, "pending payments section should exist");
assert.match(html, /Histórico de pagamentos/, "payment history section should exist");
assert.match(html, /openStudentPaymentDetails/, "students should be able to view payment details");
assert.match(html, /Mensalidades e histórico/, "student dashboard should link to finance");
assert.match(html, /function renderCoachOwnFinancePanel\(\)/, "coach finance should show the professor's own payments");
assert.match(html, /renderCoachFinanceTabs/, "coach finance should split own monthly fee and receivables into tabs");
assert.match(html, /\.coach-finance-tabs/, "coach finance tabs should use a dedicated UI component");
assert.match(html, /role="tablist"/, "coach finance tabs should expose tab semantics");
assert.match(html, /aria-selected/, "coach finance tabs should expose selected state");
assert.match(html, /Minha mensalidade/, "coach finance should label the own monthly fee clearly");
assert.match(html, /Recebimentos/, "coach finance should label student receivables clearly");
assert.match(html, /loadMyPayments\(\)/, "coach finance should load the professor's own payments");
assert.match(html, /Total pendente/, "coach own finance should include pending amount summary");
assert.match(html, /Quando uma mensalidade for criada para você/, "coach own finance should explain empty state");
assert.doesNotMatch(html, /Minha mensalidade com o ADM|Total que devo|Você não tem cobranças abertas com o ADM/, "coach finance copy should avoid admin/debt wording");

console.log("Student finance static QA checks passed");
