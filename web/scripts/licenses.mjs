// Сводка лицензий production-зависимостей (рекурсивно по package.json в node_modules)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const root = new URL("..", import.meta.url).pathname;
const seen = new Map();
function visit(name, from) {
  let dir = from;
  let pj;
  // ищем пакет вверх по дереву node_modules, как Node
  for (;;) {
    const p = join(dir, "node_modules", name, "package.json");
    if (existsSync(p)) { pj = p; break; }
    const up = join(dir, "..");
    if (up === dir) return;
    dir = up;
  }
  if (seen.has(pj)) return;
  const j = JSON.parse(readFileSync(pj, "utf8"));
  const lic = typeof j.license === "string" ? j.license : j.license?.type ?? (j.licenses ? j.licenses.map((l) => l.type ?? l).join(" OR ") : "UNKNOWN");
  seen.set(pj, { name: j.name, version: j.version, lic });
  for (const d of Object.keys({ ...j.dependencies, ...j.optionalDependencies })) visit(d, join(pj, ".."));
}
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const d of Object.keys(pkg.dependencies)) visit(d, root);
const by = {};
for (const { name, version, lic } of seen.values()) (by[lic] ??= []).push(`${name}@${version}`);
for (const [lic, list] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) console.log(`${lic} (${list.length})${list.length <= 6 ? ": " + list.join(", ") : ""}`);
console.log("\nпрямые:", Object.keys(pkg.dependencies).map((d) => { const v = [...seen.values()].find((x) => x.name === d); return `${d}=${v?.lic}`; }).join(", "));
