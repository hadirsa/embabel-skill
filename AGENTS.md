# AGENTS.md — maintaining embabeler

This repository is an Agent Skill for building Embabel agents. If you change it, keep it trustworthy: the whole point is that an agent can rely on what it says.

## The one rule

**Never make up Embabel code, imports, properties or behaviour.** Every Java snippet in `references/` is either an excerpt of code that is compiled and tested here (`assets/project-template`, `examples/cookbook`) or is marked `<!-- official: https://... -->` directly above the fence and was copied verbatim from an official source. `npm test` enforces this. A claim about behaviour ("returns null replans", "needs post") must be backed by a test in the cookbook or by the official docs, and the reference states which.

Embabel's own repository says the same: examples come from its repo, the examples repo, the templates, or repositories you were told to use.

## Layout

- `SKILL.md`: the entry point. Under 500 lines; workflow, rules and a reference index. Frontmatter follows https://agentskills.io/specification (name equals the repository name, description under 1024 characters).
- `references/`: one topic per file, one level deep, loaded on demand. Link each from `SKILL.md`.
- `assets/project-template/`: what `create-project.mjs` generates: `common/` plus `java/` or `kotlin/`. Tokens: `{{package}}`, `{{AgentName}}`, `{{artifactId}}`, `{{embabelAgentVersion}}`, `{{springBootVersion}}`, `{{javaVersion}}`, `{{language}}`, `{{sourceDir}}`, `{{ext}}`, paths `__PACKAGE_PATH__` and `__AgentName__`.
- `assets/plan-check/`: `AgentPlanCheck` and `AgentPlanTest`, added to every generated project and by `add-plan-check.mjs`. One Java implementation serves Java and Kotlin projects, because it reads Embabel's agent model rather than source code.
- `examples/cookbook/`: tested Java pattern examples, copied into a generated project with `--with-cookbook`. Pitfall agents use the `pitfalls` Spring profile so only `PitfallAgentsTest` sees them.
- `examples/pitfalls-kotlin/`: broken Kotlin agents that `verify-scaffold.mjs --kotlin` adds, proving the plan check works for Kotlin.
- `scripts/`: Node.js ES modules using **only Node built-ins** (no npm dependencies), working on macOS, Linux and Windows. `scripts/lib/` holds the testable logic.
- `tests/`: `node:test` suites for scripts and docs.
- `versions.json`: the single source of truth for versions.

## Definition of done for any change

```bash
npm test                                           # scripts, docs, links, snippet guard (no network)
node scripts/sync-versions-in-docs.mjs --check     # version tables in sync
node scripts/verify-scaffold.mjs --with-cookbook   # generated project passes its real Maven tests (needs Java 25, network)
node scripts/verify-scaffold.mjs --gradle --kotlin # same with Gradle; any mix of --gradle, --kotlin, --with-cookbook
node scripts/verify-scaffold.mjs                   # the default scaffold alone
node scripts/verify-scaffold.mjs --kotlin          # Kotlin scaffold + Kotlin pitfall proof
```

If you touched anything a reference quotes, `npm test` will tell you which snippet to update. Do not weaken a test to make it pass; fix the snippet or the code.

## Bumping versions

1. Edit `versions.json` only (including `verifiedOn`).
2. `node scripts/verify-scaffold.mjs --with-cookbook --embabel-version <x.y.z>` first, to prove the combination works.
3. `node scripts/sync-versions-in-docs.mjs`, then the checks above.
4. Do not write version numbers into prose elsewhere; link to `references/VERSIONS.md`.
5. Run `node scripts/check-official-snippets.mjs` (network) to see whether official snippets drifted.

## Adding a new pattern or claim

1. Add it to `examples/cookbook` with a test that demonstrates the behaviour, including the failing path where relevant.
2. Run `node scripts/verify-scaffold.mjs --with-cookbook`.
3. Quote it in the relevant reference with a contiguous excerpt, and state which test proves it.
4. If you discovered a pitfall, add it to `references/PITFALLS.md` with the evidence letter (R reproduced, S source, D docs).

## The plan checks

`AgentPlanCheck` (assets/plan-check) is the authoritative check: it reads the model Embabel builds, in Java and Kotlin alike. A new rule needs a pitfall agent that really gets stuck at runtime and a test asserting the rule reports it, in the cookbook (Java) and in `examples/pitfalls-kotlin`. Before shipping a change, run it against the official `embabel-agent-examples` (Java and Kotlin modules) with `add-plan-check.mjs`; the only expected error there is the Kotlin `Researcher` condition that no action declares in `post`.

`scripts/check-plan.mjs` is the quick static version for Java sources. It is a heuristic, not a compiler. Keep it conservative: prefer a warning or info over a false error. Before shipping a change to it, run it against the cookbook, the scaffold, and the official `embabel-agent-examples`; those must stay free of errors. Add a test for every rule and every false positive you fix.

## Style

- Write instructions in the imperative and explain why a rule exists; a model follows a reason better than a bare MUST.
- Keep `SKILL.md` lean; move detail to `references/`.
- Never commit secrets or a `.env`. Examples use empty placeholders.
- The user reviews changes before they are committed.
