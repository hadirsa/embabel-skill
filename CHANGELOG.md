# Changelog

Versions follow [semantic versioning](https://semver.org/) for the skill itself, independent of Embabel's version. Each release lists the Embabel and Spring Boot combination it was verified with; the current one is in [references/VERSIONS.md](references/VERSIONS.md).

## 0.1.0

First release.

- Project generator (`create-project.mjs`): Java or Kotlin, Maven or Gradle, with an agent, domain types, a tool, and unit and integration tests that need no LLM and no API key.
- Plan check that runs as a test (`AgentPlanTest`): reads the agent model Embabel builds and fails the build on a missing or unreachable goal, a dependency cycle, or a `pre` condition that no action declares in `post`. `add-plan-check.mjs` adds it to existing projects; `check-plan.mjs` is a quick static version for Java sources.
- Cookbook of tested Java patterns: routing, conditions, states, domain tools, review loops and human-in-the-loop, plus deliberately broken agents proving the plan check reports them (Java and Kotlin).
- References for concepts, actions, prompting, tools, domain model, workflows, testing, configuration, invoking and pitfalls, with a guard that every Java snippet is compiled and tested here or copied from an official source.
- CI building five scaffold variants on every push, and a weekly canary against the newest Embabel release.
