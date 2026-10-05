# Embabel concepts: how an agent actually runs

Read this first. Almost every Embabel bug that compiles is a misunderstanding of one idea: **the plan is inferred from method signatures**.

## The four building blocks

| Concept | In code | What it is |
|---------|---------|------------|
| Action | `@Action` method | One step. May call an LLM, a Spring service, or plain code. |
| Goal | `@AchievesGoal` on an action | What "done" means. The goal's value is the action's return type. |
| Condition | `@Condition` method or `pre`/`post` on `@Action` | Extra facts the planner can test (see [ACTIONS.md](ACTIONS.md)). |
| Domain model | Java records / classes | The typed objects flowing between actions. See [DOMAIN-MODEL.md](DOMAIN-MODEL.md). |

An agent is a class annotated `@Agent(description = ...)`. It is a Spring component, so it is created by Spring and can take constructor-injected services.

## Type-driven data flow

Each action's **parameter types are its preconditions** and its **return type is its effect**. The planner chains actions so that every needed type exists before the action that needs it runs, ending at the goal.

The scaffold in `assets/project-template` has this flow:

```text
UserInput -> extractRequest -> BriefingRequest
BriefingRequest -> gatherFacts -> Facts
BriefingRequest + Facts -> writeBriefing -> Briefing   (goal)
```

Nobody wrote that sequence. It follows from these three signatures:

```java
public BriefingRequest extractRequest(UserInput userInput, Ai ai) {
```

```java
public Facts gatherFacts(BriefingRequest request, Ai ai) {
```

```java
public Briefing writeBriefing(BriefingRequest request, Facts facts, Ai ai) {
```

Consequences you must internalize:

- A new action only runs if a path of types leads to its inputs. A typo-level mismatch (a different record) silently disconnects it.
- Two actions that return the same type create a choice for the planner. Use distinct types unless you want that choice.
- Types are matched on the object, so a raw `String` or `List` as a flow type matches everything. Wrap values in records.
- `Ai`, `OperationContext` and similar infrastructure parameters are injected by the framework and do **not** take part in planning.

## The blackboard and replanning

Every object produced by an action (and any input you pass at invocation) is placed on the process's **blackboard**. After each action the planner looks at what is on the blackboard and replans. This is what makes flows adapt: if an action returns `null`, nothing new appears and the planner looks for another route; if there is none, the process ends as `STUCK`.

Checking this behaviour is cheap with the integration test base class; see [TEST.md](TEST.md) and the `RoutingAgent` example in `examples/cookbook`.

## Choosing a planner

Set it on the agent: `@Agent(description = "...", planner = PlannerType.UTILITY)`. The default is GOAP.

| Planner | Best for | Needs a goal? |
|---------|----------|---------------|
| `GOAP` (default) | Business processes with a defined output; deterministic and predictable | yes |
| `UTILITY` | Exploration and event-driven systems; picks the highest-value available action each step | no |
| `HYBRID` | Gather-then-synthesize pipelines that stop once a real goal is met | yes |
| `SUPERVISOR` | Flexible multi-step workflows where an LLM chooses which action to call | yes |

Start with GOAP. Reach for another planner only when you can say why the type chain cannot express the problem. The three alternative planners are described in the official guide under "Choosing a Planner".

## Where autonomy lives

Embabel's design stance: put the LLM where judgment is needed and ordinary code everywhere else. Small focused actions with typed outputs are more reliable and testable than one big prompt, and they let you use a different model (cheap for extraction, strong for writing) per step.

## Official sources

- Guide: `https://docs.embabel.com/embabel-agent/guide/<version>/` (use the version in your `pom.xml`; the unversioned URL returns 403)
- Examples: https://github.com/embabel/embabel-agent-examples
