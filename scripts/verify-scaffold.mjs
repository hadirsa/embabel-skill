#!/usr/bin/env node
// The definition of "done" for this skill: generate a project from assets/project-template and run
// its real test suite with Maven or Gradle (unit + integration, LLM mocked). If this fails, the skill is wrong.
//
//   node scripts/verify-scaffold.mjs [--kotlin] [--gradle] [--with-cookbook] [--embabel-version x.y.z] [--spring-boot-version x.y.z] [--keep]
//
// Needs Java 25 (the default target) and network access (Maven Central). Exit code mirrors the build result.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { copyTemplate } from './lib/template.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({
  options: {
    'embabel-version': { type: 'string' },
    'spring-boot-version': { type: 'string' },
    keep: { type: 'boolean', default: false },
    'with-cookbook': { type: 'boolean', default: false },
    kotlin: { type: 'boolean', default: false },
    gradle: { type: 'boolean', default: false },
  },
});

const out = mkdtempSync(join(tmpdir(), 'embabel-scaffold-'));
const args = [join(root, 'scripts', 'create-project.mjs'), 'verify-agent', 'com.example.verify', '--output-dir', out];
if (values['with-cookbook']) args.push('--with-cookbook');
if (values.kotlin) args.push('--kotlin');
if (values.gradle) args.push('--gradle');
if (values['embabel-version']) args.push('--embabel-version', values['embabel-version']);
if (values['spring-boot-version']) args.push('--spring-boot-version', values['spring-boot-version']);

const created = spawnSync('node', args, { stdio: 'inherit' });
if (created.status !== 0) process.exit(created.status ?? 1);

const project = join(out, 'verify-agent');
if (values.kotlin) {
  // Kotlin proof that the plan check catches broken agents (the Java proof lives in the cookbook).
  copyTemplate(join(root, 'examples', 'pitfalls-kotlin'), project, { package: 'com.example.verify', PACKAGE_PATH: 'com/example/verify' });
}
const windows = process.platform === 'win32';
const [wrapper, testArgs] = values.gradle
  ? [windows ? 'gradlew.bat' : './gradlew', ['--no-daemon', '--console=plain', 'test']]
  : [windows ? 'mvnw.cmd' : './mvnw', ['-B', '-ntp', 'test']];
console.log(`\nRunning ${wrapper} test in ${project} ...`);
const result = spawnSync(wrapper, testArgs, { cwd: project, stdio: 'inherit', shell: windows });
let status = result.status ?? 1;

if (values.gradle) {
  // Gradle prints no totals: sum the JUnit reports, and treat "no tests ran" as a failure.
  const reports = join(project, 'build', 'test-results', 'test');
  const totals = { tests: 0, failures: 0, errors: 0, skipped: 0 };
  for (const file of existsSync(reports) ? readdirSync(reports).filter((f) => f.endsWith('.xml')) : []) {
    const suite = /<testsuite\b[^>]*>/.exec(readFileSync(join(reports, file), 'utf8'))?.[0] ?? '';
    for (const key of Object.keys(totals)) totals[key] += Number(new RegExp(`\\b${key}="(\\d+)"`).exec(suite)?.[1] ?? 0);
  }
  console.log(`Tests run: ${totals.tests}, Failures: ${totals.failures}, Errors: ${totals.errors}, Skipped: ${totals.skipped}`);
  if (totals.tests === 0) status = 1;
}

if (values.keep) console.log(`Project kept at ${project}`);
else rmSync(out, { recursive: true, force: true });
process.exit(status);
