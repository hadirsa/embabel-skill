// "Never make up code": every ```java block in references/ must be either
//   (a) an excerpt of code that is compiled and tested in this repo (assets/project-template, examples/cookbook), or
//   (b) marked as copied from an official source with a line directly above it:  <!-- official: https://... -->
// Excerpts are matched ignoring whitespace, so they must be contiguous pieces of the real files.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { render } from '../scripts/lib/template.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const squash = (text) => text.replace(/\s+/g, '');

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const full = join(dir, entry);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

const vars = {
  language: 'Java', sourceDir: 'src/main/java', testDir: 'src/test/java', ext: 'java',
  package: 'com.example.app', AgentName: 'Briefing', agentName: 'briefing', groupId: 'com.example.app',
  artifactId: 'demo', projectName: 'demo', embabelAgentVersion: '1.5.2', springBootVersion: '4.1.0', javaVersion: '25',
};
const compiled = ['assets/project-template', 'assets/plan-check', 'examples']
  .flatMap((dir) => walk(join(root, dir)))
  .filter((f) => f.endsWith('.java') || f.endsWith('.kt'))
  .map((f) => squash(render(readFileSync(f, 'utf8'), vars)));

function javaBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^```java\s*$/.test(lines[i])) continue;
    let end = i + 1;
    while (end < lines.length && !/^```\s*$/.test(lines[end])) end++;
    let prev = i - 1;
    while (prev >= 0 && lines[prev].trim() === '') prev--;
    blocks.push({ line: i + 1, code: lines.slice(i + 1, end).join('\n'), marker: prev >= 0 ? lines[prev].trim() : '' });
    i = end;
  }
  return blocks;
}

test('every Java snippet in references/ is compiled code or explicitly marked official', () => {
  const problems = [];
  let checked = 0;
  for (const file of readdirSync(join(root, 'references')).filter((f) => f.endsWith('.md'))) {
    const path = join(root, 'references', file);
    for (const block of javaBlocks(readFileSync(path, 'utf8'))) {
      checked++;
      const where = `${relative(root, path)}:${block.line}`;
      const official = /^<!-- official: https:\/\/\S+ -->$/.test(block.marker);
      if (official) continue;
      if (block.marker.startsWith('<!-- official')) { problems.push(`${where}: malformed official marker`); continue; }
      if (!compiled.some((source) => source.includes(squash(block.code)))) {
        problems.push(`${where}: not found in compiled sources: ${block.code.trim().split('\n')[0].trim()}`);
      }
    }
  }
  assert.ok(checked > 20, `expected to check many snippets, saw ${checked}`);
  assert.deepEqual(problems, []);
});

test('the snippet check can fail: an invented snippet is detected', () => {
  const invented = squash('public Foo thisMethodDoesNotExist(UserInput in) { return null; }');
  assert.ok(!compiled.some((source) => source.includes(invented)));
});
