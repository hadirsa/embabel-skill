# AGENTS.md — {{projectName}}

An Embabel agent application: {{language}}, Spring Boot, {{buildTool}}. Embabel {{embabelAgentVersion}}, Spring Boot {{springBootVersion}}.
Read this before changing code. It exists because the framework's data flow is type-driven and easy to break silently.

## Commands

```bash
{{testCommand}}  # unit, integration and plan-check tests; no API key, no network LLM calls
{{runCommand}}  # interactive shell; run the agent with: x "your request" -p -r
```

Run `{{testCommand}}` before presenting any change as finished.

## How the agent works

- Methods annotated `@Action` are steps. **Their parameter and return types are the plan:** an action runs once
  all its parameter types exist on the blackboard, and its return type becomes available to the next actions.
- The action annotated `@AchievesGoal` is the terminal step. Exactly one per agent flow.
- Current flow: `UserInput -> BriefingRequest -> Facts -> Briefing`. See `{{sourceDir}}/.../agent/{{AgentName}}Agent.{{ext}}`.
- Domain types in `domain/` (records / data classes) are the typed vocabulary. Rename them to your domain; keep them immutable.
- Only methods annotated `@LlmTool` on an object passed to `withToolObject(...)` are visible to the LLM.
  Expose read-only, safe operations. Think hard before exposing anything that mutates state.

## Rules

1. **Test first.** Every new or changed action gets a unit test using `FakeOperationContext` before the code.
   Assert what matters about the LLM call: prompt content, temperature, attached tools.
2. **Never call a real LLM in tests.** Unit tests use `FakeOperationContext`; integration tests extend
   `EmbabelMockitoIntegrationTest`. If a test needs an API key, it is wrong.
3. **Keep the type chain connected.** Two actions returning the same type, an unreachable input type, or a missing
   `@AchievesGoal` stall the planner without a compile error. `AgentPlanTest` (in `src/test/java/.../plan/`) reads
   the model Embabel builds and fails on an unreachable goal, a dependency cycle, or a condition used in `pre`
   that no action declares in `post`. Read its report before changing the flow, and keep it green.
4. **One Embabel version.** All `com.embabel.agent` artifacts use the one version property in the build file. Never mix versions.
   Embabel 1.5.x needs Spring Boot 4.x; Spring Boot 3.5.x fails with missing Spring AI classes.
5. **Pick temperature by job:** `0.0` for extraction and classification, around `0.2` for factual summaries,
   `0.7+` for creative writing.
6. **Secrets stay in the environment.** Never commit `.env`; never print or log keys, prompts that contain user
   secrets, or tool outputs that contain them.
7. **Configuration is YAML.** Settings go in `src/main/resources/application.yml` (profiles: `application-<profile>.yml`).
   Do not add an `application.properties`: Spring loads both and the properties values win.
8. **Do not invent Embabel APIs.** Check the sources below; if something is not there, ask.

## Where to look things up

- Reference docs: https://docs.embabel.com/embabel-agent/guide/{{embabelAgentVersion}}/ (annotations, planners, tools, testing)
- Working examples: https://github.com/embabel/embabel-agent-examples
- Starter templates: https://github.com/embabel/java-agent-template and https://github.com/embabel/kotlin-agent-template
- Library docs via Context7: `/embabel/embabel-agent`

## Adding a step to the flow

1. Add or reuse a domain type for the new output type.
2. Write a failing unit test for the new action (prompt + temperature + tools).
3. Add the `@Action` method; make sure its input types are produced earlier in the chain.
4. Update the integration test to stub the new LLM call, then run `{{testCommand}}`.
