// Fails when a native binary in the bundle needs a newer glibc than the
// shared host has (CloudLinux 8 = glibc 2.28; ADR-0040).
//   node infra/cpanel/check-glibc.mjs <bundle dir> [max minor, default 28]
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.argv[2];
const max = Number(process.argv[3] ?? 28);
if (!root) {
  console.error("usage: check-glibc.mjs <dir> [max]");
  process.exit(2);
}

const native = /\.node$|\.so$|\.so\.\d/;
let checked = 0;
const bad = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && native.test(entry.name) && statSync(full).size > 0) {
      checked++;
      const text = readFileSync(full).toString("latin1");
      let need = 0;
      for (const m of text.matchAll(/GLIBC_2\.(\d+)/g)) need = Math.max(need, Number(m[1]));
      if (need > max) bad.push(`${path.relative(root, full)} needs GLIBC_2.${need}`);
    }
  }
}
walk(root);
if (bad.length) {
  console.error(`Native binaries too new for glibc 2.${max}:\n  ${bad.join("\n  ")}`);
  // Shown as annotations on the GitHub run (readable without signing in).
  if (process.env.GITHUB_ACTIONS) for (const b of bad) console.log(`::error::${b}`);
  process.exit(1);
}
console.log(`${checked} native binaries ok for glibc 2.${max}`);
