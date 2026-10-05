# Pitfalls: what goes wrong, why, and the fix

Each entry was reproduced (R), read from the framework source (S), or taken from the official docs (D); the letter says how much to trust it.

## Stack and versions

### Spring Boot 3.5 with Embabel 1.5 fails at startup (R)

Symptom: the application context fails with `Could not find class [org.springframework.ai.model.tool.autoconfigure.ToolCallingAutoConfiguration]` / `ClassNotFoundException`, while plain unit tests with `FakeOperationContext` still pass, so the failure hides until the first integration test or run.

Cause: Embabel 1.5.x is built on Spring Boot 4.1 and Spring AI 2.x. The official `java-agent-template` pins Spring Boot 3.5.13 and Embabel 0.3.5. Bumping only `embabel-agent.version` breaks it.

Fix: use Spring Boot 4.x in the parent POM. Verified combination: Embabel 1.5.2 + Spring Boot 4.1.0 + Java 25 (Java 21 also works).

### The official templates and the project-creator lag the releases (R)

As checked on 2026-10-05, the official `java-agent-template` (the repository the project-creator copies) still pinned Embabel 0.3.5 and Spring Boot 3.5.13 while the latest release was 1.5.2. Do not trust a template's versions: take them from [VERSIONS.md](VERSIONS.md), and run the tests immediately after generating.

### Mixed Embabel versions (D)

All `com.embabel.agent` artifacts must share one version. A compile error that "looks like a missing method" usually means an API from a different version.

### Documentation URLs (R)

`https://docs.embabel.com/embabel-agent/guide/` without a version returns 403. Use `.../guide/<version>/`, for example `.../guide/1.5.2/`. Docs examples sometimes use older spellings (`context.ai().createObject(...)`) next to newer ones (`Ai`, `creating(...).fromPrompt(...)`); both compile on 1.5.2.

## Imports cheat sheet

Never guess imports; an earlier generator produced `com.embabel.agent.annotation.*`, which does not exist. Verified by compiling the scaffold and cookbook:

| Type | Package |
|------|---------|
| `@Agent`, `@Action`, `@AchievesGoal`, `@Condition`, `@State`, `@Export`, `@LlmTool`, `@EmbabelComponent` | `com.embabel.agent.api.annotation` |
| `Ai`, `OperationContext`, `ActionContext` | `com.embabel.agent.api.common` |
| `UserInput` | `com.embabel.agent.domain.io` |
| `LlmOptions` | `com.embabel.common.ai.model` |
| `AgentInvocation` | `com.embabel.agent.api.invocation` |
| `AgentProcessStatusCode` | `com.embabel.agent.core` |
| `WaitFor` | `com.embabel.agent.core.hitl` |
| `RepeatUntilAcceptableBuilder`, `TextFeedback` | `com.embabel.agent.api.common.workflow.loop` |
| `Tool` | `com.embabel.agent.api.tool` |
| `FakeOperationContext`, `FakePromptRunner` | `com.embabel.agent.test.unit` |
| `EmbabelMockitoIntegrationTest` | `com.embabel.agent.test.integration` |

## Planning

### A stuck flow hides behind a NullPointerException (R)

`AgentInvocation.invoke` throws `NullPointerException: get(...) must not be null` when no goal object was produced. Use `run(...)` and check `process.getStatus()` for `STUCK`. See [TEST.md](TEST.md).

### A `@Condition` that is never declared in `post` never fires (R)

The condition can be true and the gated action still never runs. Declare the condition in `post = {...}` on the action that produces the inspected data. `ConditionPitfallAgent` in the cookbook proves it; `AgentPlanTest` fails with `CONDITION_NEVER_SET`. Embabel's startup validator accepts this flow, so do not rely on startup logs.

### Returning `null` replans, and may end the process STUCK (R)

Useful for routing, dangerous when it is a bug. Make sure every `null` branch has another route to the goal, and test it.

### Two actions that produce the same type from the same inputs (S)

The planner may pick either. Use distinct types, or guard with conditions. `AgentPlanTest` warns with `DUPLICATE_PRODUCER`.

### Raw `String`/`List` as flow types (S)

A `String` parameter matches any `String` on the blackboard. Wrap in records. Reported as `WEAK_FLOW_TYPE`.

### No `@AchievesGoal` (D)

A GOAP agent cannot execute without one. Only `PlannerType.UTILITY` is goal-less.

### `@State` as a non-static inner class (D)

Throws `IllegalStateException`. Use a record or a static nested class (`STATE_INNER_CLASS`).

### `clearBlackboard = true` on a goal action (D)

It removes the tracking the goal depends on. Use it on intermediate actions.

### Zero-parameter actions (R)

The docs say actions need a parameter; official examples have entry actions with none, and the platform accepts them. Not a bug, but check it is intentional.

## Tools

### A tool method is not visible to the LLM (R)

Only `@LlmTool` (or Spring AI `@Tool`) methods are exposed, and only for prompts where the object was passed to `withToolObject(...)`. Assert it in a unit test: `getInteraction().getTools()`.

### Tool groups missing at runtime (D)

`withToolGroup(CoreToolGroups.WEB)` only works if the group is configured in your environment. Check with the shell command `tools`.

## Testing

### An `@Agent` nested in a test class is never registered (R)

Spring Boot skips classes nested in test classes during scanning. Use a top-level test class.

### Provider key not found by Maven or Gradle (S)

The scaffold activates provider starters by environment variable at **build** time. A `.env` file does nothing by itself; `set -a; source .env; set +a` first.

### OpenAI-compatible base URL without `/v1` (R)

Every model call fails with `com.openai.errors.NotFoundException: 404: 404`. The client appends only `/chat/completions` to the base URL, so set `OPENAI_CUSTOM_BASE_URL` to `https://host/v1`, or set `completions-path` for servers with other paths. Reproduced against Ollama's OpenAI-compatible API: with `http://localhost:11434` the ranker retries 5 times and the app exits with code 1; with `http://localhost:11434/v1` it works. See [CONFIGURATION.md](CONFIGURATION.md#openai-compatible-endpoints).

### The default model is not in the custom provider's `models` list (R)

`embabel-agent-starter-openai-custom` registers only the models in `embabel.agent.platform.models.openai.custom.models` (or `OPENAI_CUSTOM_MODELS`). If `embabel.models.default-llm` names anything else, including the shipped default when you leave it unset, the application does not start:

```text
IllegalArgumentException: Default LLM 'gpt-4o-mini' not found. Set the 'embabel.models.default-llm' property to one of the available models: [qwen3:1.7b].
```

Set `default-llm` to a listed model. The same rule applies to roles and to models named in `LlmOptions.withModel(...)`: list every one of them.

### The endpoint is down, and the agent looks stuck (R)

An unreachable or overloaded provider shows up in the agent log as `LLM invocation ranker retry attempt 1 of 5 after: 504: Unknown` (or 502/503), with stack traces through Embabel's shell. That is the provider, not the agent: a gateway that times out can take a minute or more per attempt before it answers 504. Take the agent out of the picture by calling the endpoint directly, without printing the key:

```bash
curl -s -o /dev/null -w "%{http_code} in %{time_total}s\n" \
  -H "Authorization: Bearer $OPENAI_CUSTOM_API_KEY" "$OPENAI_CUSTOM_BASE_URL/models"
```

Anything other than 200 is a provider or URL problem.

Two retry settings decide how long a run keeps waiting, and the log line names which one is retrying:

| Log line says | Setting | Default |
|---|---|---|
| `ranker retry` (choosing the agent for a free-text request, as `x "..."` in the shell does) | `embabel.agent.platform.ranking.max-attempts` | 5 attempts, backoff from 100 ms |
| a model name, for example `LLM invocation gpt-4o-mini retry attempt 1 of 10` (the calls an action makes) | `embabel.agent.platform.models.<provider>.max-attempts`, for example `...openai.custom.max-attempts` | 10 attempts, backoff from 5 s, ×5, up to 180 s |

Lower them while developing so a dead endpoint fails in seconds, not minutes.

### The default model is OpenAI-flavoured (D)

`embabel.models.default-llm` has a shipped default. If you use Anthropic, Ollama or another provider, set it explicitly or calls will target a model your provider does not have.

### Custom temperature rejected by some models (D)

Remove `withTemperature` for that model.

## Secrets and safety

- Never commit `.env`; keep `.env.sample` with empty values.
- Never `cat` or print `.env`, and never paste keys into prompts, logs or test fixtures.
- Think before giving an LLM a tool that mutates state. Prefer read-only tools and put business rules in the tool, not the prompt.
