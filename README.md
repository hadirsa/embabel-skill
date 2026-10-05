# Embabeler

[![CI](https://github.com/hadirsa/embabeler/actions/workflows/ci.yml/badge.svg)](https://github.com/hadirsa/embabeler/actions/workflows/ci.yml)
[![License: Apache 2.0](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Embabel](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhadirsa%2Fembabeler%2Fmain%2Fversions.json&query=%24.embabelAgentVersion&label=Embabel&color=orange)](references/VERSIONS.md)
[![Spring Boot](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhadirsa%2Fembabeler%2Fmain%2Fversions.json&query=%24.springBootVersion&label=Spring%20Boot&color=6DB33F&logo=springboot&logoColor=white)](references/VERSIONS.md)

**Documentation site: <https://hadirsa.github.io/embabeler/>**

An [Agent Skill](https://agentskills.io/specification) for scaffolding, testing and plan-checking [Embabel](https://github.com/embabel/embabel-agent) agents on the JVM (Java or Kotlin, Spring Boot, Maven or Gradle). It works with Claude Code, Cursor, Copilot, Codex and other agents that load skills.

- **Verified scaffold.** Generates a runnable project with an agent, domain types, a tool, and tests that need no LLM and no API key.
- **Plan check.** `AgentPlanTest` fails the build when an agent can never reach its goal, which the compiler cannot catch.
- **Tested references.** Every Java snippet in the docs is compiled and tested here, or marked as copied from an official source and checked against it.

## Quick start

Install the skill:

```bash
npx skills add hadirsa/embabeler
```

Then ask your agent for what you want, for example *"Create an Embabel agent that triages support tickets, with tests."*

Or generate a project directly (run from the skill's directory, for example `~/.claude/skills/embabeler`):

```bash
node scripts/create-project.mjs trip-planner com.acme.trip --output-dir "$PWD/.."
```

```bash
cd ../trip-planner && ./mvnw test
```

## Requirements

<!-- versions:start -->
| Component | Version |
|-----------|---------|
| Embabel Agent | 1.5.2 |
| Spring Boot | 4.1.0 |
| Java | 25 |
| Maven (wrapper) | 3.9.6 |
| Gradle (wrapper) | 9.8.0 |
| Kotlin (Gradle projects) | 2.3.21 |

Last verified by building and testing the scaffold on 2026-10-05.
<!-- versions:end -->

- Java 25 by default. Java 21 or newer works with `--java-version 21`.
- Node.js 20 or newer (the scripts use Node built-ins only).
- Network access to Maven Central.
- An LLM API key is only needed to run an agent for real. The generated project has Maven profiles for OpenAI, Anthropic and OpenAI-compatible endpoints, and runs on a local Ollama model with no key.

## Installation

With the [`skills` CLI](https://github.com/vercel-labs/skills), which installs into Claude Code, Cursor, Codex and other agents:

```bash
npx skills add hadirsa/embabeler
```

Manually, for Claude Code:

```bash
git clone https://github.com/hadirsa/embabeler ~/.claude/skills/embabeler
```

Other tools use their own skills directory, for example `.cursor/skills/` or `.agents/skills/` in a project. See your tool's documentation.

## Features

### Plan check

Embabel plans from method signatures: an `@Action`'s parameter types are its preconditions, its return type is its effect, and the planner chains actions to the `@AchievesGoal`. Many mistakes compile and then stall at runtime.

`AgentPlanTest` reads the agent model Embabel builds at startup, so it works for Java and Kotlin. It fails the build on a missing or unreachable goal, a dependency cycle, or a condition used in `pre` that no action declares in `post`. It warns about ambiguous producers and weak flow types. Embabel's own startup validation accepts some flows that can never finish; this test does not.

Example, from the deliberately broken cycle agent in the cookbook (output of the static checker, `scripts/check-plan.mjs`):

```text
ERROR   UNREACHABLE_GOAL  CyclePitfallAgent.java:38
         Goal action write() can never run: Outline, Research is produced only by actions that cannot run themselves (a dependency cycle or missing link).
         -> Trace the chain backwards from the goal and make sure every input type is produced by an action whose inputs are available.
WARNING UNREACHABLE_ACTION  CyclePitfallAgent.java:27
         Action outline() can never run: waiting for Research.
WARNING UNREACHABLE_ACTION  CyclePitfallAgent.java:32
         Action research() can never run: waiting for Outline.

1 agent(s) checked: 1 error(s), 2 warning(s).
```

Add the test to an existing project (Java or Kotlin):

```bash
node scripts/add-plan-check.mjs /path/to/project com.acme.yourpackage
```

Run the static checker without a build. It reads Java sources only (Kotlin is not supported by this script), defaults to `src/main/java`, and exits 1 on errors (`--strict` also fails on warnings, `--json` prints JSON):

```bash
node scripts/check-plan.mjs path/to/src/main/java
```

### Scaffold

`scripts/create-project.mjs <name> <package>` generates a project on the [tested version combination](references/VERSIONS.md).

| Option | Effect |
| --- | --- |
| `--kotlin` | Kotlin sources instead of Java |
| `--gradle` | Gradle build instead of Maven |
| `--with-cookbook` | Adds the tested pattern examples (Java only; not combinable with `--kotlin`) |
| `--java-version 21` | Targets Java 21 |
| `--agent-name`, `--output-dir`, `--latest`, `--dry-run` | See the usage line of the script |

### Cookbook and pitfalls

- [examples/cookbook](examples/cookbook): compiled, tested Java examples of routing, conditions, states, domain tools, review loops and human-in-the-loop, plus deliberately broken agents that really get stuck at runtime, with tests proving the plan check reports them.
- [examples/pitfalls-kotlin](examples/pitfalls-kotlin): the same check against broken Kotlin agents.
- [references/PITFALLS.md](references/PITFALLS.md): each entry says whether it was reproduced, read from the framework source, or taken from the docs.

### Kept current

Versions live in [versions.json](versions.json). CI builds the scaffold in five variants on every push (Java, Java with cookbook, Kotlin, Gradle Java with cookbook, Gradle Kotlin), and a weekly job rebuilds it against the newest Embabel release and checks the copied official snippets against their sources.

## Example prompts

- "Create an Embabel agent that triages support tickets, with tests."
- "Add a tool to my Embabel agent so the LLM can look up an account balance."
- "My Embabel agent never reaches its goal. Why?"
- "Expose this agent over MCP."

## Repository layout

```text
SKILL.md                      entry point: workflow, rules, reference index
references/                   CONCEPTS, ACTIONS, PROMPTING, TOOLS, DOMAIN-MODEL, WORKFLOWS,
                              TEST, CONFIGURATION, INVOKING, PITFALLS, VERSIONS
scripts/                      create-project, add-plan-check, check-plan, verify-scaffold,
                              check-versions, check-official-snippets, sync-versions-in-docs
assets/project-template/      generated project: common/, java/, kotlin/ (language files),
                              maven/ and gradle/ (each with common/, java/, kotlin/ build files)
assets/plan-check/            AgentPlanCheck and AgentPlanTest, added to every project
examples/                     cookbook (Java) and pitfalls-kotlin
tests/                        Node tests for the scripts and docs (npm test)
versions.json                 single source of truth for versions
CHANGELOG.md, AGENTS.md       release notes, contributor and agent rules
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md). Changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
