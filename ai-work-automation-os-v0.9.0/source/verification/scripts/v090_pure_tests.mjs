#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js";

const root = resolve(new URL("../..", import.meta.url).pathname);
const out = mkdtempSync(join(tmpdir(), "aiwa-v090-pure-"));
const inputs = [
  "src/lib/contracts.ts", "src/lib/templates.ts", "src/lib/workflow-policy.ts", "src/lib/product.ts", "src/lib/ids.ts",
  "tests/contracts-v090.test.ts", "tests/v090-core.test.ts", "tests/v090-security.test.ts"
];
for (const input of inputs) {
  const source = readFileSync(join(root, input), "utf8");
  const result = ts.transpileModule(source, {
    fileName: input,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
      strict: true
    },
    reportDiagnostics: true
  });
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0) {
    for (const error of errors) console.error(ts.flattenDiagnosticMessageText(error.messageText, "\n"));
    process.exit(1);
  }
  const destination = join(out, input.replace(/\.ts$/, ".js"));
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, result.outputText, "utf8");
}
const testFiles = inputs.filter((value) => value.includes(".test.")).map((value) => join(out, value.replace(/\.ts$/, ".js")));
const run = spawnSync(process.execPath, ["--test", ...testFiles], { cwd: out, encoding: "utf8" });
process.stdout.write(run.stdout);
process.stderr.write(run.stderr);
process.exit(run.status ?? 1);
