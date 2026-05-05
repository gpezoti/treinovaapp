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

console.log("Student finance static QA checks passed");
