# Versions and upgrading

The table below is generated from `versions.json` by `node scripts/sync-versions-in-docs.mjs`. Do not edit it by hand.

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

## Compatibility facts

- Embabel Agent 1.5.x is built on **Spring Boot 4.x** and Spring AI 2.x. Spring Boot 3.5.x fails at startup (see [PITFALLS.md](PITFALLS.md#spring-boot-35-with-embabel-15-fails-at-startup-r)).
- Generated projects target Java 25, the current LTS. Embabel itself is compiled for Java 21, so `--java-version 21` works when a team is not on 25 yet.
- `embabel-agent-test` must match `embabel-agent-starter` exactly.
- Gradle Kotlin projects set the Kotlin plugin version themselves; keep it equal to the Kotlin version Spring Boot manages (Maven projects inherit it from the Spring Boot parent).

## Is there a newer Embabel?

```bash
node scripts/check-versions.mjs
```

Releases: https://github.com/embabel/embabel-agent/releases. Latest published artifacts: https://repo1.maven.org/maven2/com/embabel/agent/embabel-agent-starter/maven-metadata.xml

## Upgrading the pinned version (maintainers)

1. Try the candidate against the real scaffold and cookbook:
   ```bash
   node scripts/verify-scaffold.mjs --with-cookbook --embabel-version <x.y.z>
   ```
2. If it fails with missing Spring AI classes, the Spring Boot parent no longer matches. Find the Boot version Embabel builds with in the `spring-boot.version` property of the `embabel-build` parent POM for that release (https://github.com/embabel/embabel-build/blob/main/pom.xml) and retry with `--spring-boot-version`.
3. If an API changed, fix the scaffold/cookbook first, then the references that quote it. `npm test` fails when a Java snippet in `references/` no longer matches compiled code.
4. Update `versions.json` (including `verifiedOn`), then:
   ```bash
   node scripts/sync-versions-in-docs.mjs
   npm test
   node scripts/verify-scaffold.mjs --with-cookbook
   ```

## Upgrading an existing project

Change `embabel-agent.version` in the POM, or `embabelAgentVersion` in `build.gradle.kts` (one place), align the Spring Boot version with the table above, run the tests, and read the release notes of every release you skip. `AgentPlanTest` in that run tells you if any agent's plan broke.
