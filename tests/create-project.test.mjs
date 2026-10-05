import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findUnresolvedTokens, pascalCase, render, validatePackage, validateProjectName } from '../scripts/lib/template.mjs';
import { parseLatestRelease } from '../scripts/lib/versions.mjs';
import { analyzeSources } from '../scripts/lib/plan-check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts', 'create-project.mjs');

const walk = (dir) => readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

test('render replaces known tokens and leaves unknown ones', () => {
  assert.equal(render('a {{x}} b __Y__ {{z}}', { x: '1', Y: '2' }), 'a 1 b 2 {{z}}');
  assert.deepEqual(findUnresolvedTokens('{{a}} and {{b}}'), ['{{a}}', '{{b}}']);
});

test('names are validated with helpful messages', () => {
  assert.throws(() => validateProjectName('Trip Planner'), /Invalid project name/);
  assert.throws(() => validateProjectName('-bad'), /Invalid project name/);
  assert.doesNotThrow(() => validateProjectName('trip-planner'));
  assert.throws(() => validatePackage('Com.Acme'), /Invalid Java package/);
  assert.throws(() => validatePackage('com.acme.class'), /reserved Java word/);
  assert.doesNotThrow(() => validatePackage('com.acme.trip'));
  assert.equal(pascalCase('trip-planner'), 'TripPlanner');
});

test('parseLatestRelease prefers <release>, else the highest plain version', () => {
  assert.equal(parseLatestRelease('<metadata><versioning><release>1.5.2</release></versioning></metadata>'), '1.5.2');
  assert.equal(parseLatestRelease('<versions><version>1.0.0-RC1</version><version>1.0.0</version></versions>'), '1.0.0');
  assert.equal(parseLatestRelease('<nothing/>'), null);
});

test('creates a project with every token resolved, a runnable mvnw and a plan that checks clean', () => {
  const out = mkdtempSync(join(tmpdir(), 'embabeler-'));
  execFileSync('node', [script, 'trip-planner', 'com.acme.trip', '--output-dir', out], { encoding: 'utf8' });
  const dir = join(out, 'trip-planner');

  assert.ok(existsSync(join(dir, 'src/main/java/com/acme/trip/agent/TripPlannerAgent.java')));
  assert.ok(existsSync(join(dir, 'src/test/java/com/acme/trip/agent/TripPlannerAgentTest.java')));
  assert.ok(statSync(join(dir, 'mvnw')).mode & 0o111, 'mvnw must be executable');

  const files = walk(dir);
  for (const file of files) assert.deepEqual(findUnresolvedTokens(readFileSync(file, 'utf8')), [], file);

  const pom = readFileSync(join(dir, 'pom.xml'), 'utf8');
  const versions = JSON.parse(readFileSync(join(root, 'versions.json'), 'utf8'));
  assert.match(pom, new RegExp(`<embabel-agent.version>${versions.embabelAgentVersion.replaceAll('.', '\\.')}</embabel-agent.version>`));
  assert.match(pom, new RegExp(`<version>${versions.springBootVersion.replaceAll('.', '\\.')}</version>`));
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /guide\/\d+\.\d+\.\d+\//);

  const javaSources = files.filter((f) => f.endsWith('.java') && f.includes('src/main')).map((file) => ({ file, text: readFileSync(file, 'utf8') }));
  const { findings } = analyzeSources(javaSources);
  assert.deepEqual(findings.filter((f) => f.severity !== 'info'), []);
});

test('refuses to overwrite a non-empty directory and rejects bad input without a stack trace', () => {
  const out = mkdtempSync(join(tmpdir(), 'embabeler-'));
  execFileSync('node', [script, 'demo-agent', 'com.acme.demo', '--output-dir', out]);
  const again = spawnSync('node', [script, 'demo-agent', 'com.acme.demo', '--output-dir', out], { encoding: 'utf8' });
  assert.equal(again.status, 1);
  assert.match(again.stderr, /Refusing to overwrite/);
  assert.doesNotMatch(again.stderr, /\n\s+at /);

  const bad = spawnSync('node', [script, 'Bad Name', 'com.acme', '--output-dir', out], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Invalid project name/);

  const relative = spawnSync('node', [script, 'ok-name', 'com.acme', '--output-dir', 'relative/path'], { encoding: 'utf8' });
  assert.equal(relative.status, 1);
  assert.match(relative.stderr, /absolute path/);
});

test('agent name defaults from the project name and can be overridden', () => {
  const out = mkdtempSync(join(tmpdir(), 'embabeler-'));
  execFileSync('node', [script, 'support-desk-agent', 'com.acme.desk', '--output-dir', out]);
  assert.ok(existsSync(join(out, 'support-desk-agent/src/main/java/com/acme/desk/agent/SupportDeskAgent.java')));
  execFileSync('node', [script, 'other', 'com.acme.other', '--agent-name', 'Concierge', '--output-dir', out]);
  assert.ok(existsSync(join(out, 'other/src/main/java/com/acme/other/agent/ConciergeAgent.java')));
});

test('the Kotlin variant generates Kotlin sources plus the shared Java plan check', () => {
  const out = mkdtempSync(join(tmpdir(), 'embabeler-'));
  execFileSync('node', [script, 'trip-planner', 'com.acme.trip', '--kotlin', '--output-dir', out]);
  const dir = join(out, 'trip-planner');
  assert.ok(existsSync(join(dir, 'src/main/kotlin/com/acme/trip/agent/TripPlannerAgent.kt')));
  assert.ok(existsSync(join(dir, 'src/test/kotlin/com/acme/trip/agent/TripPlannerAgentTest.kt')));
  assert.ok(existsSync(join(dir, 'src/test/java/com/acme/trip/plan/AgentPlanTest.java')));
  assert.ok(!existsSync(join(dir, 'src/main/java')), 'no Java main sources in a Kotlin project');
  assert.match(readFileSync(join(dir, 'pom.xml'), 'utf8'), /kotlin-maven-plugin/);
  assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /Kotlin, Spring Boot, Maven/);
  for (const file of walk(dir)) assert.deepEqual(findUnresolvedTokens(readFileSync(file, 'utf8')), [], file);

  const both = spawnSync('node', [script, 'other', 'com.acme.other', '--kotlin', '--with-cookbook', '--output-dir', out], { encoding: 'utf8' });
  assert.equal(both.status, 1);
  assert.match(both.stderr, /Java only/);
});

test('--gradle swaps the Maven build for a Gradle one, for Java and Kotlin', () => {
  const out = mkdtempSync(join(tmpdir(), 'embabeler-'));
  for (const [name, extra] of [['gj', []], ['gk', ['--kotlin']]]) {
    execFileSync('node', [script, name, 'com.acme.demo', '--gradle', ...extra, '--output-dir', out]);
    const dir = join(out, name);
    assert.ok(statSync(join(dir, 'gradlew')).mode & 0o111, 'gradlew must be executable');
    for (const absent of ['pom.xml', 'mvnw', '.mvn']) assert.ok(!existsSync(join(dir, absent)), `${absent} must not exist`);
    const jar = join(dir, 'gradle/wrapper/gradle-wrapper.jar');
    assert.deepEqual(readFileSync(jar), readFileSync(join(root, 'assets/project-template/gradle/common/gradle/wrapper/gradle-wrapper.jar')), 'wrapper jar copied byte for byte');
    const build = readFileSync(join(dir, 'build.gradle.kts'), 'utf8');
    assert.match(build, /embabel-agent-test:\$embabelAgentVersion/);
    if (extra.length) assert.match(build, /kotlin\("plugin.spring"\)/);
    assert.match(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), /\.\/gradlew test/);
    assert.match(readFileSync(join(dir, 'settings.gradle.kts'), 'utf8'), new RegExp(`rootProject.name = "${name}"`));
    for (const file of walk(dir).filter((f) => !f.endsWith('.jar'))) assert.deepEqual(findUnresolvedTokens(readFileSync(file, 'utf8')), [], file);
  }
});

test('every generated project gets the plan check', () => {
  const out = mkdtempSync(join(tmpdir(), 'embabeler-'));
  execFileSync('node', [script, 'demo', 'com.acme.demo', '--output-dir', out]);
  const plan = join(out, 'demo/src/test/java/com/acme/demo/plan');
  assert.ok(existsSync(join(plan, 'AgentPlanCheck.java')));
  assert.match(readFileSync(join(plan, 'AgentPlanTest.java'), 'utf8'), /AgentPlanCheck\.check\(agentPlatform, "com\.acme\.demo"\)/);
});

test('add-plan-check installs into an existing Maven project and refuses to overwrite', () => {
  const addScript = join(root, 'scripts', 'add-plan-check.mjs');
  const project = mkdtempSync(join(tmpdir(), 'embabel-existing-'));
  const noPom = spawnSync('node', [addScript, project, 'com.acme.app'], { encoding: 'utf8' });
  assert.equal(noPom.status, 1);
  assert.match(noPom.stderr, /No pom.xml or build.gradle/);

  writeFileSync(join(project, 'pom.xml'), '<project><artifactId>kotlin-maven-plugin</artifactId></project>');
  const ok = spawnSync('node', [addScript, project, 'com.acme.app'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /embabel-agent-test/, 'warns about the missing test dependency');
  assert.match(ok.stdout, /Kotlin project/, 'explains the Kotlin test-compile setup');
  const check = readFileSync(join(project, 'src/test/java/com/acme/app/plan/AgentPlanCheck.java'), 'utf8');
  assert.match(check, /^package com\.acme\.app\.plan;/);

  const again = spawnSync('node', [addScript, project, 'com.acme.app'], { encoding: 'utf8' });
  assert.equal(again.status, 1);
  assert.match(again.stderr, /Refusing to overwrite/);
});
