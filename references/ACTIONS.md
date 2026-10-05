# Agents, actions, goals and conditions

Verified against Embabel 1.5.2 source and tested in `examples/cookbook`. Imports are listed in [PITFALLS.md](PITFALLS.md#imports-cheat-sheet).

## `@Agent`

`description` is required and is used by LLM-based agent selection, so write it for a reader deciding whether this agent fits a request. Other attributes: `name`, `provider`, `version`, `planner` (see [CONCEPTS.md](CONCEPTS.md#choosing-a-planner)), `scan`, `beanName`, `opaque`, `actionRetryPolicy`, `actionRetryPolicyExpression`, `delay`.

`@EmbabelComponent` marks a class that contributes actions, goals and conditions to agents without being an agent itself; it mostly pairs with the Utility planner.

## `@Action`

Attributes: `description`, `pre`, `post`, `canRerun`, `readOnly`, `clearBlackboard`, `outputBinding`, `cost`, `value`, `costMethod`, `valueMethod`, `trigger`, `actionRetryPolicy`, `actionRetryPolicyExpression`, `delayMs`.

- `canRerun = false` (default): an action runs at most once per process. Set it to `true` for actions that must repeat, such as a chat handler that returns `this`.
- `readOnly = true` documents that the action has no external side effects.
- `clearBlackboard = true` removes everything except the action's output. Use it on intermediate actions and to make loops possible. Avoid it on `@AchievesGoal` actions: the official docs warn it can interfere with goal satisfaction.

## Parameters

There are two kinds, in any order:

- **Domain objects**: backed by the blackboard; they are the action's preconditions. A parameter marked nullable (`org.springframework.lang.Nullable`) is filled if present and does not block the action.
- **Infrastructure**: `Ai` (preferred for LLM calls), `OperationContext`, `ActionContext` (needed to run subprocesses such as the loop builders), `ProcessContext`. The docs advise the least specific type that works.

The reference docs say an action needs at least one parameter. Official examples contradict this: `Subagents.acquireTarget()` in embabel-agent-examples is an entry action with no parameters, and the cookbook's `FormAgent.askForName()` is accepted and registered by the platform (`FormAgentTest`). Such an action has no preconditions, so it can run at the start of the plan, which suits a human-in-the-loop form. The static `scripts/check-plan.mjs` reports it as information.

## Return types

- A single domain object is the normal case.
- **`null` means "nothing produced"**: the planner replans. If no other route reaches the goal, the process ends `STUCK`. The `RoutingAgent.route` action in the cookbook relies on this for unknown categories.
- **Routing by subtype**: return a supertype, and write one handler per subtype. Only the handler matching the concrete object that was returned can run.

```java
    @Action
    public Intent route(Classification classification, UserInput userInput) {
        return switch (classification.category()) {
            case "refund" -> new Refund(userInput.getContent());
            case "question" -> new Question(userInput.getContent());
            default -> null; // unknown category: nothing is produced, the planner replans
        };
    }
```

```java
    @Action
    public Draft handleRefund(Refund refund, Ai ai) {
        return new Draft(ai.withDefaultLlm().generateText("Write a refund confirmation for: " + refund.reason()));
    }
```

- **Several outputs at once**: return a record implementing `SomeOf` with nullable fields; each non-null field is bound to the blackboard.

## Goals and exporting

`@AchievesGoal(description = ...)` goes on the terminal action. Without one a GOAP agent cannot execute (only the `UTILITY` planner is goal-less).

```java
    @AchievesGoal(
            description = "A short briefing has been written for the requested audience",
            export = @Export(remote = true, name = "writeBriefing"))
```

`@Export` attributes: `name` (exported goal name), `remote` (expose over MCP/A2A; needed for clients such as Claude Desktop to see the agent), `local` (default true), `startingInputTypes` (inputs a UI may prompt for).

## Conditions

A condition is a named boolean the planner can test. Define it with `@Condition(name = "...")` taking the domain objects it inspects (it is false until they exist), and gate an action with `pre`.

```java
    @Condition(name = "urgent")
    public boolean urgent(Ticket ticket) {
        return ticket.severity() >= 4;
    }
```

```java
    @AchievesGoal(description = "An urgent ticket has been escalated")
    @Action(pre = {"urgent"})
```

**You must also declare the condition in `post` on the action that produces the data it inspects**, or the planner assumes the condition is never set and the gated action never runs. This is verified: `ConditionAgent` works with the declaration; `ConditionPitfallAgent` (same shape, no `post`) ends `STUCK` even though its condition is true.

```java
    @Action(post = {"urgent"})
```

Condition methods are evaluated repeatedly during planning, so keep them free of side effects. `AgentPlanTest` fails on a `pre` condition that no action lists in `post` (`CONDITION_NEVER_SET`); Embabel's own startup validation does not catch this. Run against the official examples, the check found exactly this pattern in the Kotlin `Researcher` agent: its "redo research" actions require `reportUnsatisfactory`, which no action declares in `post`.

For expression-style conditions the docs describe `pre = {"spel:..."}` using Spring Expression Language against blackboard bindings.

## Cost and value

`cost` and `value` (0 to 1) bias the planner when several routes exist; `@Cost` methods compute them dynamically (their domain parameters must be nullable). They matter mainly with the Utility planner.

## Official sources

- Annotation model: the "Annotation model" page of the guide for your Embabel version.
- Examples: `StarNewsFinder` and `BookWriter` in https://github.com/embabel/embabel-agent-examples
