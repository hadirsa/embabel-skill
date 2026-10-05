# Loops, branches and human input

GOAP chains actions by type, which is ideal for straight-through flows. It is awkward for loops. Embabel gives you four tools for the cases a type chain cannot express. Everything marked "cookbook" is compiled and tested in `examples/cookbook`.

| You need | Use | Where |
|----------|-----|-------|
| Different path per kind of input | Subtype routing | `RoutingAgent` (see [ACTIONS.md](ACTIONS.md#return-types)) |
| A gate on an action | `@Condition` with `pre`/`post` | `ConditionAgent` |
| A loop with distinct phases | `@State` classes | `LoopStatesAgent` |
| "Retry until good enough" with a reviewer | `RepeatUntilAcceptableBuilder` | `ReviewLoopAgent` |
| Parallel fan-out and merge | `ScatterGatherBuilder` | official docs |
| Wait for a person | `WaitFor.formSubmission` | `FormAgent` |

## States

Annotate the classes an action can return with `@State`. When an action returns a state object the framework hides earlier states, binds the new one and replans from there, so you reason about one phase at a time. Non-state objects stay on the blackboard.

```java
    @State
    public interface Outcome {
    }
```

`@State` is inherited, so annotating the shared interface covers every implementing record.

```java
    public record Counting(int round) implements Outcome {

        @Action(clearBlackboard = true)
        public Outcome tick() {
            return round >= 2 ? new Finished(round) : new Counting(round + 1);
        }
    }
```

```java
    public record Finished(int rounds) implements Outcome {

        @AchievesGoal(description = "The loop has finished")
        @Action
        public Result finish() {
            return new Result(rounds);
        }
    }
```

Rules (from the official docs, and `LoopStatesAgentIntegrationTest` proves the loop terminates with `rounds == 2`):

- State classes must be records or **static** nested classes, or top-level classes. A non-static inner class throws `IllegalStateException`; the static `scripts/check-plan.mjs` flags it as `STATE_INNER_CLASS`.
- To return to a state type you have already visited (a loop), the returning action needs `clearBlackboard = true`; pass any data you need forward through the state's fields, because the blackboard is wiped.
- Return `this` with `canRerun = true` to stay in the current state (typical for chat).
- Put `@AchievesGoal` on a terminal state's action.

## Repeat until acceptable

For a writer/reviewer loop you can package the whole thing as one atomic action:

```java
        return RepeatUntilAcceptableBuilder
                .returning(Story.class)
                .withMaxIterations(5)
                .withScoreThreshold(.8)
```

```java
                .withEvaluator(context -> promptRunner.createObject(
                        "Score this story from 0 to 1 and explain briefly:\n" + context.getResultToEvaluate(),
                        TextFeedback.class))
                .build()
                .asSubProcess(actionContext, Story.class);
```

It needs the `ActionContext` parameter to run as a subprocess. `ReviewLoopAgentIntegrationTest` stubs a low score then a high score and asserts that the second draft wins, which shows how to test loops without an LLM. Always set `withMaxIterations` so a stubborn reviewer cannot loop forever.

## Scatter-gather and other builders

`ScatterGatherBuilder` runs several generators in parallel and consolidates the results; `ConsensusBuilder` specialises it for agreement between models; `SimpleAgentBuilder` builds a one-action agent. Agents built this way are registered by exposing an `Agent` `@Bean`. This official example shows the shape:

<!-- official: https://github.com/embabel/embabel-agent-examples/blob/main/examples-java/src/main/java/com/embabel/example/factchecker/FactChecker.java -->
```java
        return ScatterGatherBuilder
                .returning(FactChecks.class)
                .fromElements(FactCheck.class)
                .generatedBy(llmFactChecks)
                .consolidatedBy(this::reconcileFactChecks)
                .asSubProcess(context);
```

## Human in the loop

`WaitFor.formSubmission(prompt, Type.class)` pauses the process in the `WAITING` state, generates a form from the record's fields, and resumes when it is submitted. An entry action with no parameters is the usual way to start with a form.

```java
    @Action
    public Person askForName() {
        return WaitFor.formSubmission("Please enter your name", Person.class);
    }
```

## Subagents

An agent can run another agent as a subprocess or hand off to it as a tool (`Subagent`, `RunSubagent`, `ActionContext.asSubProcess`). See the official guide's Annotation model and Tools pages for the exact APIs; they were not exercised in this skill's cookbook.
