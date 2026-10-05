#!/usr/bin/env node
// Adds the plan-check test (AgentPlanCheck + AgentPlanTest) to an existing Embabel project: Java or Kotlin, Maven or Gradle.
// It reads the agent model Embabel builds at test time, so it understands both languages exactly.
//
//   node scripts/add-plan-check.mjs <project-dir> <base-package>
//
// <base-package> is the package your agents live in (agents outside it, e.g. framework ones, are skipped).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { copyTemplate, validatePackage } from './lib/template.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function main() {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { help: { type: 'boolean', short: 'h' } } });
  if (values.help || positionals.length !== 2) {
    console.log('Usage: node scripts/add-plan-check.mjs <project-dir> <base-package>');
    return values.help ? 0 : 1;
  }
  const project = resolve(positionals[0]);
  const pkg = positionals[1];
  validatePackage(pkg);

  const buildFile = ['pom.xml', 'build.gradle.kts', 'build.gradle'].map((f) => join(project, f)).find(existsSync);
  if (!buildFile) throw new Error(`No pom.xml or build.gradle(.kts) in ${project}. This script supports Maven and Gradle projects.`);
  const gradle = !buildFile.endsWith('pom.xml');
  const target = join(project, 'src/test/java', ...pkg.split('.'), 'plan');
  for (const file of ['AgentPlanCheck.java', 'AgentPlanTest.java']) {
    if (existsSync(join(target, file))) throw new Error(`Refusing to overwrite ${join(target, file)}`);
  }

  copyTemplate(join(root, 'assets', 'plan-check'), project, { package: pkg, PACKAGE_PATH: pkg.split('.').join('/') });
  console.log(`Added ${target}/AgentPlanCheck.java and AgentPlanTest.java`);

  const build = readFileSync(buildFile, 'utf8');
  if (!build.includes('embabel-agent-test')) {
    console.log('\nAdd the test dependency (same version as your other com.embabel.agent artifacts):');
    console.log(gradle
      ? '  testImplementation("com.embabel.agent:embabel-agent-test:<version>")'
      : '  com.embabel.agent:embabel-agent-test, <scope>test</scope>');
  }
  // Gradle compiles src/test/java next to Kotlin out of the box; Maven needs the Kotlin plugin set up for it.
  if (!gradle && build.includes('kotlin-maven-plugin') && !build.includes('src/test/java')) {
    console.log('\nKotlin project: the check is Java test code. Make sure Maven compiles src/test/java, e.g. by listing it');
    console.log('in the kotlin-maven-plugin test-compile <sourceDirs> and keeping the maven-compiler-plugin testCompile execution.');
    console.log('The Kotlin template in this skill (assets/project-template/maven/kotlin/pom.xml) shows a working setup.');
  }
  console.log(`\nThen run: ${gradle ? './gradlew test --tests AgentPlanTest' : './mvnw test -Dtest=AgentPlanTest'}`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
