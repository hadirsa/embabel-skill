#!/usr/bin/env node
// Confirms that Java snippets marked "<!-- official: <github blob url> -->" in references/ still
// appear (ignoring whitespace) in the official file they claim to come from.
// Needs network access. Markers that point to documentation pages (not GitHub files) are listed
// as "not machine-checkable" and must be re-read by a human when the guide changes.
//
//   node scripts/check-official-snippets.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const squash = (text) => text.replace(/\s+/g, '');

function officialBlocks(text, file) {
  const lines = text.split('\n');
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const marker = /^<!-- official: (https:\/\/\S+) -->$/.exec(lines[i].trim());
    if (!marker) continue;
    let start = i + 1;
    while (start < lines.length && lines[start].trim() === '') start++;
    if (!/^```java\s*$/.test(lines[start] ?? '')) continue;
    let end = start + 1;
    while (end < lines.length && !/^```\s*$/.test(lines[end])) end++;
    found.push({ file, line: start + 1, url: marker[1], code: lines.slice(start + 1, end).join('\n') });
  }
  return found;
}

const toRaw = (url) => {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/.exec(url);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}` : null;
};

const blocks = readdirSync(join(root, 'references'))
  .filter((f) => f.endsWith('.md'))
  .flatMap((f) => officialBlocks(readFileSync(join(root, 'references', f), 'utf8'), `references/${f}`));

let failures = 0;
const cache = new Map();
for (const block of blocks) {
  const raw = toRaw(block.url);
  if (!raw) {
    console.log(`SKIP  ${block.file}:${block.line} not machine-checkable (${block.url})`);
    continue;
  }
  if (!cache.has(raw)) {
    const res = await fetch(raw);
    cache.set(raw, res.ok ? squash(await res.text()) : null);
  }
  const source = cache.get(raw);
  if (source === null) { failures++; console.log(`FAIL  ${block.file}:${block.line} cannot fetch ${raw}`); continue; }
  if (source.includes(squash(block.code))) console.log(`OK    ${block.file}:${block.line}`);
  else { failures++; console.log(`FAIL  ${block.file}:${block.line} no longer matches ${block.url}`); }
}
console.log(`\n${blocks.length} official snippet(s) checked, ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
