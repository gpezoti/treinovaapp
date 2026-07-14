import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = readdirSync("outputs")
  .filter((file) => /^qa-.*tests\.mjs$/.test(file))
  .sort();

if (!files.length) throw new Error("Nenhuma suíte de QA estática foi encontrada.");

for (const file of files) {
  const result = spawnSync(process.execPath, [`outputs/${file}`], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`qa:static: OK (${files.length} suítes)`);
