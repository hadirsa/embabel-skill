# Embabeler

[![CI](https://github.com/hadirsa/embabeler/actions/workflows/ci.yml/badge.svg)](https://github.com/hadirsa/embabeler/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Agent Skill](https://img.shields.io/badge/Agent%20Skill-spec-8A2BE2)](https://agentskills.io/specification)
[![Embabel](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhadirsa%2Fembabeler%2Fmain%2Fversions.json&query=%24.embabelAgentVersion&label=Embabel&color=orange)](references/VERSIONS.md)
[![Spring Boot](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhadirsa%2Fembabeler%2Fmain%2Fversions.json&query=%24.springBootVersion&label=Spring%20Boot&color=6DB33F&logo=springboot&logoColor=white)](references/VERSIONS.md)
[![Java | Kotlin](https://img.shields.io/badge/Java%20%7C%20Kotlin-JVM-007396)](references/VERSIONS.md)
[![Maven | Gradle](https://img.shields.io/badge/build-Maven%20%7C%20Gradle-C71A36)](references/VERSIONS.md)

An [Agent Skill](https://agentskills.io/specification) that teaches coding agents (Claude Code, Cursor, Copilot, Codex and others) to build [Embabel](https://github.com/embabel/embabel-agent) agents correctly: goal-driven AI agents on the JVM with Java or Kotlin, Spring Boot, and Maven or Gradle.

**The Embabel skill that proves what it says:** every code sample compiles, every generated project passes its tests, and a plan check fails the build when an agent can never reach its goal.

## Why this exists

Embabel plans from method signatures: each `@Action`'s parameter types are its preconditions, its return type is its effect, and the planner chains actions to the `@AchievesGoal`. That is powerful, and it means many mistakes compile and then stall at runtime. Agents asked to "write an Embabel agent" from memory also get imports and APIs wrong, and the official templates lag the releases (at the time of writing the Java template pins Embabel 0.3.5 on Spring Boot 3.5, which does not work with 1.5.x).

This skill gives an agent:

- **A verified starting project**, in Java or Kotlin, on a [tested Embabel and Spring Boot combination](references/VERSIONS.md), with an agent, domain types, a tool, and unit and integration tests that need no LLM and no API key.
- **Conventions that prevent the stalls**, with the reason behind each, in a short `SKILL.md` plus on-demand references.
- **A plan check that runs as a test** (`AgentPlanTest`). It reads the agent model Embabel builds at startup, so it works the same for Java and Kotlin, and fails the build on what the compiler cannot see: a missing or unreachable goal, a dependency cycle, a condition used in `pre` that no action declares in `post`. It also warns about ambiguous producers and weak flow types. It extends Embabel's own startup validation, which accepts some flows that can never finish. `scripts/add-plan-check.mjs` adds it to existing projects.
- **Compiled, tested examples** (the cookbook) of routing, conditions, states, domain tools, review loops and human-in-the-loop, plus deliberately broken agents that really get stuck at runtime, with tests proving the plan check reports them (in Java and Kotlin).
- **Pitfalls with evidence**: each entry in [PITFALLS.md](references/PITFALLS.md) says whether it was reproduced, read from the framework source, or taken from the docs, so you know how far to trust it.
- **A "no invented code" guard**: every Java snippet in the documentation is either an excerpt of code that is compiled and tested here, or is marked as copied from an official source (and checked against it).
- **Kept current with Embabel**: versions live in one file, CI builds the scaffold in five variants (Java, Kotlin, Maven, Gradle, with and without the cookbook) on every push, and a weekly job rebuilds it against the newest Embabel release and checks the copied official snippets against their sources.

## Install

With the [`skills` CLI](https://github.com/vercel-labs/skills), which installs into Claude Code, Cursor, Codex and other agents:

```bash
npx skills add hadirsa/embabeler
```

Or by hand: skills are folders with a `SKILL.md`, so put this repository where your tool looks for skills, for example for Claude Code:

```bash
git clone https://github.com/hadirsa/embabeler ~/.claude/skills/embabeler
```

Other tools use their own skills directory (for example `.cursor/skills/` or `.agents/skills/` in a project); see your tool's documentation. Requirements: Java 25 (or 21+ with --java-version 21), Node.js 20+, network access to Maven Central. An LLM API key is only needed to run an agent for real: the generated project switches providers with Maven profiles for OpenAI, Anthropic and any OpenAI-compatible endpoint, and runs on a local Ollama model with no key at all.

## Use it

Just ask for what you want. The skill triggers on Embabel-related requests:

- "Create an Embabel agent that triages support tickets, with tests."
- "Add a tool to my Embabel agent so the LLM can look up an account balance."
- "My Embabel agent never reaches its goal. Why?"
- "Expose this agent over MCP."

Or use the scripts directly:

```bash
# Create a project (--kotlin for Kotlin; --gradle for Gradle; --with-cookbook adds the tested Java pattern examples)
node scripts/create-project.mjs trip-planner com.acme.trip --output-dir "$PWD"
cd trip-planner && ./mvnw test            # includes AgentPlanTest (./gradlew test with --gradle)

# Add the plan check to an existing Embabel project (Java or Kotlin)
node /path/to/embabeler/scripts/add-plan-check.mjs /path/to/project com.acme.yourpackage

# Quick static check of Java sources, no build needed
node /path/to/embabeler/scripts/check-plan.mjs
```

## What is in here

```text
SKILL.md                  entry point: workflow, rules, reference index
references/               CONCEPTS, ACTIONS, PROMPTING, TOOLS, DOMAIN-MODEL, WORKFLOWS,
                          TEST, CONFIGURATION, INVOKING, PITFALLS, VERSIONS
scripts/                  create-project, add-plan-check, check-plan, verify-scaffold, check-versions,
                          check-official-snippets, sync-versions-in-docs (Node built-ins only)
assets/project-template/  the generated project: common/, java/ or kotlin/, and maven/ or gradle/
assets/plan-check/        AgentPlanCheck + AgentPlanTest, added to every project
examples/cookbook/        tested Java pattern examples, including deliberately broken agents
examples/pitfalls-kotlin/ broken Kotlin agents that prove the plan check works for Kotlin
versions.json             single source of truth for versions
```

## Contributing

See [AGENTS.md](AGENTS.md). The short version: do not invent code, back every behavioural claim with a test, and run `npm test` and `node scripts/verify-scaffold.mjs --with-cookbook` before opening a pull request.

## License

Apache License 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
