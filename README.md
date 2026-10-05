# embabel-skill

An [Agent Skill](https://agentskills.io/specification) that teaches coding agents (Claude Code, Cursor, Copilot, Codex and others) to build [Embabel](https://github.com/embabel/embabel-agent) agents correctly: goal-driven AI agents on the JVM with Java or Kotlin, Spring Boot, and Maven or Gradle.

## Why this exists

Embabel plans from method signatures: each `@Action`'s parameter types are its preconditions, its return type is its effect, and the planner chains actions to the `@AchievesGoal`. That is powerful, and it means many mistakes compile and then stall at runtime. Agents asked to "write an Embabel agent" from memory also get imports and APIs wrong, and the official templates lag the releases (at the time of writing the Java template pins Embabel 0.3.5 on Spring Boot 3.5, which does not work with 1.5.x).

This skill gives an agent:

- **A verified starting project**, in Java or Kotlin: Embabel 1.5.2 on Spring Boot 4.1 with an agent, domain types, a tool, and unit and integration tests that need no LLM and no API key.
- **Conventions that prevent the stalls**, with the reason behind each, in a short `SKILL.md` plus on-demand references.
- **A plan check that runs as a test** (`AgentPlanTest`). It reads the agent model Embabel builds at startup, so it works the same for Java and Kotlin, and fails the build on what the compiler cannot see: a missing or unreachable goal, a dependency cycle, a condition used in `pre` that no action declares in `post`. It also warns about ambiguous producers and weak flow types. It extends Embabel's own startup validation, which accepts some flows that can never finish. `scripts/add-plan-check.mjs` adds it to existing projects.
- **Compiled, tested examples** (the cookbook) of routing, conditions, states, domain tools, review loops and human-in-the-loop.
- **A "no invented code" guard**: every Java snippet in the documentation is either an excerpt of code that is compiled and tested here, or is marked as copied from an official source (and checked against it).

## Install

Skills are folders with a `SKILL.md`. Put this repository where your tool looks for skills, for example for Claude Code:

```bash
git clone https://github.com/hadirsa/embabel-skill ~/.claude/skills/embabel-skill
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
node /path/to/embabel-skill/scripts/add-plan-check.mjs /path/to/project com.acme.yourpackage

# Quick static check of Java sources, no build needed
node /path/to/embabel-skill/scripts/check-plan.mjs
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
