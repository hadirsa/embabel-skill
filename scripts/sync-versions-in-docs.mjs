#!/usr/bin/env node
// Keeps version numbers in the docs in sync with versions.json. Text between
// <!-- versions:start --> and <!-- versions:end --> markers is regenerated.
//
//   node scripts/sync-versions-in-docs.mjs          # rewrite
//   node scripts/sync-versions-in-docs.mjs --check  # fail if anything is out of date (for CI)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadVersions } from './lib/versions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const v = loadVersions();

const table = [
  '| Component | Version |',
  '|-----------|---------|',
  `| Embabel Agent | ${v.embabelAgentVersion} |`,
  `| Spring Boot | ${v.springBootVersion} |`,
  `| Java | ${v.javaVersion} |`,
  `| Maven (wrapper) | ${v.mavenWrapperVersion} |`,
  `| Gradle (wrapper) | ${v.gradleVersion} |`,
  `| Kotlin (Gradle projects) | ${v.kotlinVersion} |`,
  '',
  `Last verified by building and testing the scaffold on ${v.verifiedOn}.`,
].join('\n');

const BLOCK = /(<!-- versions:start -->)[\s\S]*?(<!-- versions:end -->)/g;
const markdownFiles = (dir) => readdirSync(dir).flatMap((entry) => {
  if (entry === 'node_modules' || entry.startsWith('.')) return [];
  const full = join(dir, entry);
  if (statSync(full).isDirectory()) return entry === 'project-template' ? [] : markdownFiles(full);
  return full.endsWith('.md') ? [full] : [];
});

let stale = 0;
for (const file of markdownFiles(root)) {
  const before = readFileSync(file, 'utf8');
  if (!BLOCK.test(before)) continue;
  BLOCK.lastIndex = 0;
  const after = before.replace(BLOCK, `$1\n${table}\n$2`);
  if (after !== before) {
    stale++;
    if (check) console.error(`Out of date: ${file}`);
    else { writeFileSync(file, after); console.log(`Updated ${file}`); }
  }
}
if (check && stale > 0) process.exit(1);
if (!check && stale === 0) console.log('Docs already in sync.');
