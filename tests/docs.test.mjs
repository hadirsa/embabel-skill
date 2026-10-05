import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

function frontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(match, 'SKILL.md must start with YAML frontmatter');
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = /^([a-z-]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2].replace(/^"(.*)"$/, '$1');
  }
  return fields;
}

test('SKILL.md follows the Agent Skills specification', () => {
  const text = read('SKILL.md');
  const fm = frontmatter(text);
  assert.match(fm.name, /^[a-z0-9]+(-[a-z0-9]+)*$/, 'name: lowercase letters, digits, single hyphens');
  assert.ok(fm.name.length <= 64);
  assert.equal(fm.name, JSON.parse(read('package.json')).name, 'skill name matches the repository/package name');
  assert.ok(fm.description.length > 0 && fm.description.length <= 1024, `description length ${fm.description.length}`);
  assert.ok(!fm.description.includes('<') && !fm.description.includes('>'), 'no angle brackets in description');
  assert.ok((fm.compatibility ?? '').length <= 500);
  assert.ok(text.split('\n').length < 500, 'SKILL.md should stay under 500 lines');
});

test('every relative markdown link resolves, including heading anchors', () => {
  const markdownFiles = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.git') || entry === 'project-template') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.md')) markdownFiles.push(full);
    }
  };
  walk(root);

  const slug = (heading) => heading.toLowerCase().replace(/[`*_]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const anchorsOf = (file) => new Set(
    [...readFileSync(file, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])));

  const problems = [];
  for (const file of markdownFiles) {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:)/.test(target)) continue;
      const [path, anchor] = target.split('#');
      const resolved = path ? resolve(dirname(file), path) : file;
      if (!existsSync(resolved)) { problems.push(`${relative(root, file)}: missing ${target}`); continue; }
      if (anchor && resolved.endsWith('.md') && !anchorsOf(resolved).has(anchor)) {
        problems.push(`${relative(root, file)}: no heading for #${anchor} in ${relative(root, resolved)}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('every file SKILL.md points to exists, and every reference is linked from SKILL.md', () => {
  const skill = read('SKILL.md');
  for (const file of readdirSync(join(root, 'references'))) {
    assert.ok(skill.includes(`references/${file}`), `SKILL.md should link references/${file}`);
  }
  for (const script of readdirSync(join(root, 'scripts')).filter((f) => f.endsWith('.mjs'))) {
    assert.ok(skill.includes(`scripts/${script}`), `SKILL.md should mention scripts/${script}`);
  }
});

test('references are one level deep and reasonably sized', () => {
  for (const file of readdirSync(join(root, 'references'))) {
    const path = join(root, 'references', file);
    assert.ok(statSync(path).isFile(), `references/${file} must be a file (no nesting)`);
    assert.ok(read(`references/${file}`).split('\n').length < 400, `references/${file} is too long for on-demand loading`);
  }
});

test('versions in the docs are in sync with versions.json', () => {
  const versions = JSON.parse(read('versions.json'));
  const doc = read('references/VERSIONS.md');
  assert.ok(doc.includes(`| Embabel Agent | ${versions.embabelAgentVersion} |`));
  assert.ok(doc.includes(`| Spring Boot | ${versions.springBootVersion} |`));
  for (const language of ['java', 'kotlin']) {
    const pom = read(`assets/project-template/maven/${language}/pom.xml`);
    assert.ok(pom.includes('{{embabelAgentVersion}}') && pom.includes('{{springBootVersion}}'), `${language} pom must take versions from versions.json`);
    assert.ok(!/<version>\d+\.\d+\.\d+<\/version>\s*<relativePath/.test(pom), `no hard-coded Boot version in the ${language} pom`);
    const gradle = read(`assets/project-template/gradle/${language}/build.gradle.kts`);
    assert.ok(gradle.includes('{{embabelAgentVersion}}') && gradle.includes('{{springBootVersion}}'), `${language} Gradle build must take versions from versions.json`);
  }
  const wrapper = read('assets/project-template/gradle/common/gradle/wrapper/gradle-wrapper.properties');
  assert.ok(wrapper.includes(`gradle-${versions.gradleVersion}-bin.zip`), 'Gradle wrapper matches versions.json');
});
