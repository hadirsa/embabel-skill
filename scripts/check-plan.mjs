#!/usr/bin/env node
// Static check of Embabel agent flows in Java sources: missing goal, unreachable goal,
// dependency cycles, actions without parameters, invalid @State classes, ambiguous producers.
//
//   node scripts/check-plan.mjs [path ...] [--json] [--strict]
//
// Paths may be directories or .java files (default: ./src/main/java). Exit code 1 if any error
// is found (with --strict, any warning too). Java only; Node built-ins only.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { analyzeSources } from './lib/plan-check.mjs';

function collectJavaFiles(path) {
  if (!existsSync(path)) throw new Error(`Path not found: ${path}`);
  if (statSync(path).isFile()) return path.endsWith('.java') ? [path] : [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'target' || entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const full = join(path, entry.name);
    return entry.isDirectory() ? collectJavaFiles(full) : entry.name.endsWith('.java') ? [full] : [];
  });
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      json: { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node scripts/check-plan.mjs [path ...] [--json] [--strict]');
    return 0;
  }

  if (positionals.length === 0 && !existsSync('src/main/java')) {
    throw new Error('No src/main/java in the current directory. Pass a path explicitly (this checker reads Java sources only; Kotlin is not supported yet).');
  }
  const roots = positionals.length > 0 ? positionals : ['src/main/java'];
  const files = [...new Set(roots.flatMap(collectJavaFiles))];
  if (files.length === 0) throw new Error(`No .java files found under: ${roots.join(', ')}`);

  const sources = files.map((file) => ({ file: relative(process.cwd(), file), text: readFileSync(file, 'utf8') }));
  const { agents, findings } = analyzeSources(sources);
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;

  if (values.json) {
    console.log(JSON.stringify({ agents, errors, warnings, findings }, null, 2));
  } else {
    if (agents.length === 0) console.log('No @Agent or @EmbabelComponent classes found.');
    for (const f of findings) {
      const where = f.file ? `${f.file}${f.line ? ':' + f.line : ''}` : '';
      console.log(`${f.severity.toUpperCase().padEnd(7)} ${f.code}  ${where}\n         ${f.message}\n         -> ${f.hint}`);
    }
    console.log(`\n${agents.length} agent(s) checked: ${errors} error(s), ${warnings} warning(s).`);
  }
  return errors > 0 || (values.strict && warnings > 0) ? 1 : 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(2);
}
