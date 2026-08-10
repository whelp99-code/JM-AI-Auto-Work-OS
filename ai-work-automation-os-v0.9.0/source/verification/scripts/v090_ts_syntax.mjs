#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ts = await import("typescript");
const root = fileURLToPath(new URL("../..", import.meta.url));
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(path);
  }
}
walk(join(root, "src"));
walk(join(root, "tests"));
const failures = [];
for (const file of files) {
  const result = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, isolatedModules: true },
    reportDiagnostics: true
  });
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) failures.push({ file, errors: errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")) });
}
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure.file}\n${failure.errors.join("\n")}`);
  process.exit(1);
}
console.log(`PASS TypeScript/TSX syntax: ${files.length}/${files.length}`);
