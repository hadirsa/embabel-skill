# Testing agents without calling an LLM

The guiding rule, and Embabel's own: **work test-first, and never call a real LLM in a test**. A test that needs an API key is flaky, slow, and costs money. Embabel ships fakes so you never have to.

Dependency (already in the scaffold's `pom.xml`): `com.embabel.agent:embabel-agent-test` with `test` scope.

| Level | Tool | What it proves |
|-------|------|----------------|
| Unit | `FakeOperationContext` + `FakePromptRunner` | Each action builds the right prompt, temperature and tools |
| Integration | `EmbabelMockitoIntegrationTest` | The planner reaches the goal and each step calls the LLM as expected |
| Live | a real model, run by hand | Prompt quality. Not part of the build |

## Unit tests

Actions are plain methods. Instantiate the agent, call the action with a fake context, and inspect what it asked the LLM.

```java
        var context = FakeOperationContext.create();
        var promptRunner = (FakePromptRunner) context.promptRunner();
        var expected = new BriefingRequest("solar energy", "city council");
        context.expectResponse(expected);

        var result = agent.extractRequest(new UserInput("Brief the city council on solar energy"), context.ai());
```

```java
        var invocation = promptRunner.getLlmInvocations().getFirst();
        assertThat(invocation.getPrompt()).contains("city council on solar energy");
        assertThat(invocation.getInteraction().getLlm().getTemperature()).isEqualTo(0.0);
```

- `context.expectResponse(x)` queues what the next LLM call returns (an object for `creating(...)`, a string for `generateText`). Queue several in call order for actions that call the LLM more than once.
- Pass `context.ai()` where the action takes an `Ai`; pass `context` where it takes an `OperationContext`.
- Assert what matters: distinctive prompt text, temperature, attached tools (`getInteraction().getTools()`), not the full prompt string.
- Mock Spring-injected services with Mockito and pass them to the agent's constructor.

## Integration tests

Extend `EmbabelMockitoIntegrationTest`. It boots Spring, registers your agents on a real `AgentPlatform`, and replaces the LLM with stubs.

```java
        whenCreateObject(prompt -> prompt.contains("Extract the briefing topic"), BriefingRequest.class)
                .thenReturn(request);
```

```java
        whenGenerateText(prompt -> prompt.contains("Write a briefing in Markdown"))
                .thenReturn("# Solar energy\nShort briefing text.");
```

```java
        var briefing = AgentInvocation
                .create(agentPlatform, Briefing.class)
                .invoke(new UserInput("Brief the city council on solar energy"));
```

```java
        verifyNoMoreInteractions();
```

- `whenCreateObject(predicate, Type.class)` and `whenGenerateText(predicate)` stub calls by prompt content. `.thenReturn(a, b)` returns values in sequence, which is how you test loops (`ReviewLoopAgentIntegrationTest`).
- `verifyCreateObjectMatching(...)`, `verifyGenerateTextMatching(...)` and `verifyNoMoreInteractions()` prove which calls happened and that no branch ran that should not have.
- Set `System.setProperty("embabel.agent.shell.interactive.enabled", "false")` in a `@BeforeAll` so the shell does not wait for input.

### Test the failure path too: `run()` and `STUCK`

`invoke(...)` returns the goal object. If the process ends without producing it (the flow is stuck), `invoke` throws an unhelpful `NullPointerException: get(...) must not be null` from `TypedInvocation.invoke`. To assert on a stuck flow, or to diagnose one, use `run(...)` and read the process status:

```java
        var process = AgentInvocation.create(agentPlatform, Reply.class).run(new UserInput("Your service is slow"));

        assertThat(process.getStatus()).isEqualTo(AgentProcessStatusCode.STUCK);
```

Statuses: `NOT_STARTED`, `RUNNING`, `COMPLETED`, `FAILED`, `TERMINATED`, `KILLED`, `STUCK`, `WAITING`, `PAUSED`.

### Test agents must be top-level classes

Spring Boot does not component-scan classes nested inside test classes, so an `@Agent` declared as a nested class of a test is never registered ("No agent with outputClass ... found"). Declare it as its own top-level class under `src/test/java`, like `ConditionPitfallAgent` in the cookbook.

## The plan check: `AgentPlanTest`

Generated projects include `src/test/java/.../plan/AgentPlanCheck.java` and `AgentPlanTest.java` (add them to an existing project with `scripts/add-plan-check.mjs`). The test boots the platform with the LLM mocked, reads the model Embabel builds from your agents (Java or Kotlin), and simulates planning from the inputs:

| Severity | Code | Meaning |
|----------|------|---------|
| error | `NO_GOAL` | No `@AchievesGoal` action |
| error | `UNREACHABLE_GOAL` | The goal's inputs can never all exist: a cycle, a broken type chain, or a condition never set |
| error | `CONDITION_NEVER_SET` | A condition used in `pre` that no action declares in `post` |
| warning | `UNREACHABLE_ACTION` | An action that can never run |
| warning | `DUPLICATE_PRODUCER` | Two unguarded actions produce the same binding from overlapping inputs |
| warning | `WEAK_FLOW_TYPE` | `String`, `List` and similar used as flow types |
| info | `CALLER_SUPPLIED_INPUT` | Inputs nothing produces, so the caller must pass them (a typo-level type mismatch shows up here) |

The test fails on errors only and prints the whole report. It checks what the planner can know before running; a `null` returned at runtime is a separate path to cover with `run(...)` and the process status. `PitfallAgentsTest` in the cookbook (and `examples/pitfalls-kotlin`) proves each error on a deliberately broken agent, which also really ends `STUCK`.

If the project has more than one `@SpringBootApplication` class, point the test at one with `@SpringBootTest(classes = YourApplication.class)`.

## What to test for each new action

1. A unit test: prompt contains the key input, temperature is what you chose, tools are attached (or not).
2. The integration test still reaches the goal (add a stub for the new call).
3. A stuck-path test if the action can return `null` or is gated by a condition.
4. `AgentPlanTest` reports no errors (it runs as part of `./mvnw test`).

## Running

```bash
./mvnw test
```

Run the narrowest test while iterating (`./mvnw -q test -Dtest=BriefingAgentTest`, or `./gradlew test --tests BriefingAgentTest`), the full suite before you call the work done.
