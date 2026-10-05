#!/usr/bin/env node
// Creates a ready-to-run Embabel agent project (Java or Kotlin, Maven or Gradle, Spring Boot) from assets/project-template.
//
//   node scripts/create-project.mjs <project-name> <package> [options]
//
// Options:
//   --kotlin                        Generate Kotlin sources instead of Java
//   --gradle                        Build with Gradle (Kotlin DSL) instead of Maven
//   --agent-name <PascalCase>       Agent class prefix (default: derived from project name)
//   --group-id <id>                 groupId (default: the package)
//   --output-dir <absolute path>    Where the project folder is created (default: current directory)
//   --embabel-version <x.y.z>       Override the pinned Embabel version
//   --spring-boot-version <x.y.z>   Override the pinned Spring Boot version
//   --java-version <n>              Override the pinned Java version
//   --latest                        Resolve the newest Embabel release from Maven Central
//   --with-cookbook                 Also add the tested pattern examples (routing, conditions, states,
//                                   domain tools, loops, human-in-the-loop) under a cookbook/ package
//   --dry-run                       Print what would be created and exit
//
// Node built-ins only, so it behaves the same on macOS, Linux and Windows.
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  copyTemplate, isNonEmptyDir, lowerCamel, pascalCase,
  validateAgentName, validatePackage, validateProjectName,
} from './lib/template.mjs';
import { fetchLatestEmbabelRelease, loadVersions } from './lib/versions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = join(root, 'assets', 'project-template');
const planCheckDir = join(root, 'assets', 'plan-check');
const cookbookDir = join(root, 'examples', 'cookbook');

const USAGE = 'Usage: node scripts/create-project.mjs <project-name> <package> [--kotlin] [--gradle] [--agent-name Name] [--output-dir /abs/path] [--with-cookbook] [--latest] [--dry-run]';

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'agent-name': { type: 'string' },
      'group-id': { type: 'string' },
      'output-dir': { type: 'string' },
      'embabel-version': { type: 'string' },
      'spring-boot-version': { type: 'string' },
      'java-version': { type: 'string' },
      latest: { type: 'boolean', default: false },
      'with-cookbook': { type: 'boolean', default: false },
      kotlin: { type: 'boolean', default: false },
      gradle: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || positionals.length !== 2) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }

  const [projectName, pkg] = positionals;
  validateProjectName(projectName);
  validatePackage(pkg);
  const agentName = values['agent-name'] ?? pascalCase(projectName.replace(/-agent$/, ''));
  validateAgentName(agentName);

  const versions = loadVersions();
  let embabelAgentVersion = values['embabel-version'] ?? versions.embabelAgentVersion;
  if (values.latest && !values['embabel-version']) {
    embabelAgentVersion = await fetchLatestEmbabelRelease();
    if (embabelAgentVersion !== versions.embabelAgentVersion) {
      console.warn(
        `Note: latest Embabel is ${embabelAgentVersion}, but this skill was verified with ${versions.embabelAgentVersion}.\n` +
        '      Run the tests right away; if the Spring Boot version no longer matches, see references/VERSIONS.md.',
      );
    }
  }

  const outputDir = values['output-dir'] ?? process.cwd();
  if (!isAbsolute(outputDir)) throw new Error('--output-dir must be an absolute path');
  const target = resolve(outputDir, projectName);
  if (isNonEmptyDir(target)) throw new Error(`Refusing to overwrite non-empty directory: ${target}`);
  if (!existsSync(templateDir)) throw new Error(`Template not found: ${templateDir}`);

  const language = values.kotlin ? 'kotlin' : 'java';
  const buildTool = values.gradle ? 'gradle' : 'maven';
  const commands = values.gradle
    ? { testCommand: './gradlew test', runCommand: './gradlew bootRun', ollamaRunCommand: './gradlew -Pollama bootRun', planTestCommand: './gradlew test --tests AgentPlanTest' }
    : { testCommand: './mvnw test', runCommand: './mvnw spring-boot:run', ollamaRunCommand: './mvnw -Pollama spring-boot:run', planTestCommand: './mvnw test -Dtest=AgentPlanTest' };
  const vars = {
    package: pkg,
    PACKAGE_PATH: pkg.split('.').join('/'),
    AgentName: agentName,
    agentName: lowerCamel(agentName),
    groupId: values['group-id'] ?? pkg,
    artifactId: projectName,
    projectName,
    embabelAgentVersion,
    springBootVersion: values['spring-boot-version'] ?? versions.springBootVersion,
    javaVersion: values['java-version'] ?? versions.javaVersion,
    kotlinVersion: versions.kotlinVersion,
    foojayResolverVersion: versions.foojayResolverVersion,
    buildTool: values.gradle ? 'Gradle' : 'Maven',
    ...commands,
    language: values.kotlin ? 'Kotlin' : 'Java',
    sourceDir: `src/main/${language}`,
    testDir: `src/test/${language}`,
    ext: values.kotlin ? 'kt' : 'java',
  };

  if (values['dry-run']) {
    console.log(`Would create ${target}\n${JSON.stringify(vars, null, 2)}`);
    return;
  }

  if (values['with-cookbook'] && values.kotlin) {
    throw new Error('--with-cookbook is Java only for now; generate a Java project to browse the cookbook.');
  }
  const files = [
    ...copyTemplate(join(templateDir, 'common'), target, vars),
    ...copyTemplate(join(templateDir, language), target, vars),
    ...copyTemplate(join(templateDir, buildTool, 'common'), target, vars), // wrapper and settings
    ...copyTemplate(join(templateDir, buildTool, language), target, vars), // pom.xml or build.gradle.kts
    ...copyTemplate(planCheckDir, target, vars), // AgentPlanTest: language-agnostic plan check (Java test sources)
  ];
  if (values['with-cookbook']) files.push(...copyTemplate(cookbookDir, target, vars));
  console.log(`Created ${projectName} (${files.length} files) in ${target}`);
  console.log(`  ${vars.language} | ${vars.buildTool} | Embabel ${vars.embabelAgentVersion} | Spring Boot ${vars.springBootVersion} | Java ${vars.javaVersion}`);
  console.log('\nNext steps:');
  console.log(`  cd ${target}`);
  console.log(`  ${vars.testCommand.padEnd(22)} # unit, integration and plan-check tests; no LLM or API key needed`);
  console.log(`  ${'cp .env.sample .env'.padEnd(22)} # then add a provider key, and export it before running the app`);
  console.log(`  ${vars.runCommand.padEnd(22)} # interactive shell; try: x "Brief me on solar energy" -p -r`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
