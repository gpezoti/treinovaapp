import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /let _trainerSearch = "";/, "Admin trainer list should keep a search term.");
assert.match(html, /function applyTrainerFilters\(trainers\)/, "Admin trainer list should have a dedicated search filter.");
assert.match(html, /placeholder="Buscar treinador por nome, email ou telefone\.\.\."/, "Admin trainer list should expose a mobile-friendly search input.");
assert.match(html, /window\.setTrainerSearch = function\(val\)/, "Admin trainer search should re-render without navigation.");
assert.match(html, /applyTrainerFilters\(STATE\.trainers\)\.forEach\(t => _trainerSelected\.add\(t\.id\)\)/, "Bulk select should respect the visible filtered trainer list.");

assert.match(html, /function renderAdminHome\(el\)/, "Admin home should render explicitly.");
assert.match(html, /onclick="navTo\('payments'\)">Financeiro<\/button>/, "Admin quick actions should include Financeiro.");
assert.match(html, /onclick="navTo\('admin-workouts'\)">Treinos<\/button>/, "Admin quick actions should include Treinos.");
assert.match(html, /onclick="navTo\('profile'\)">Marca<\/button>/, "Admin quick actions should include brand/profile management.");

assert.match(html, /window\.generateNewTrainerPassword = function\(showFeedback = true\)/, "New trainer flow should generate a valid temporary password.");
assert.match(html, /setTimeout\(\(\) => generateNewTrainerPassword\(false\), 40\)/, "New trainer sheet should prefill the temporary password.");
assert.match(html, /id="et-status-options"/, "Edit trainer status options should have a stable selector.");
assert.match(html, /id="et-role-options"/, "Edit trainer role options should have a stable selector.");
assert.doesNotMatch(html, /querySelectorAll\('#sheet-content \.form-group'\)\[3\]/, "Edit trainer status should not depend on brittle form-group indexes.");
assert.doesNotMatch(html, /querySelectorAll\('#sheet-content \.form-group'\)\[4\]/, "Edit trainer role should not depend on brittle form-group indexes.");

assert.match(html, /Carregando financeiro\.\.\./, "Admin/coach finance should show an immediate loading state.");
assert.match(html, /const personLabelPlural = isAdmin \? "treinadores" : "alunos";/, "Admin finance overdue copy should address trainers, not students.");
assert.match(html, /<div class="lr-avatar" style="overflow:hidden;">\$\{avatarHTML\(p\)\}<\/div>/, "Finance list avatar should use the standard avatar fallback.");

console.log("qa-admin-profile-ux-tests: ok");
