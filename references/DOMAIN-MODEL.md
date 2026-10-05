# The domain model

Embabel's own guidance: a rich domain model makes a good agentic system. Domain objects are not just state. They play three roles: they give **type safety** (code can read them, prompts are typed, the LLM knows what shape to return), they **expose behaviour** to your code, and they can **expose tools** to the LLM.

## Records as the typed vocabulary

Use immutable records for the values that flow between actions. Each record type is a node in the plan.

```java
public record BriefingRequest(String topic, String audience) {
}
```

Guidelines that follow from [CONCEPTS.md](CONCEPTS.md):

- **One concept, one type.** Do not reuse `String` for "topic" and "summary". Wrap each in a record so the planner can tell them apart.
- **Name types for their role in the flow**, such as `BriefingRequest`, `Facts`, `Briefing`, not `Data` or `Result`.
- **The goal type is the contract.** The record returned by the `@AchievesGoal` action is what callers ask for with `AgentInvocation.create(agentPlatform, Briefing.class)`.
- **Keep records free of framework types** so they can be unit tested without Spring.

## Put behaviour on the data

```java
    /** Behaviour belongs on domain objects, not only data. */
    public String asBulletList() {
```

```java
    public int wordCount() {
        return markdown.isBlank() ? 0 : markdown.trim().split("\\s+").length;
    }
```

Logic like formatting for a prompt or counting words is ordinary code. Keeping it on the record means it is testable and reusable, and the action stays a thin orchestration of LLM calls.

## Constraining what the LLM generates

When an LLM creates an object (`creating(Type.class)`), Bean Validation annotations on the record are applied to the result, and `withExample(...)` shows the model what good and bad output looks like. This official snippet shows both:

<!-- official: https://github.com/embabel/java-agent-template/blob/main/src/main/java/com/embabel/template/injected/InjectedDemo.java -->
```java
    public record Animal(
            String name,
            @Pattern(regexp = ".*ox.*", message = "Species must contain 'ox'")
            String species) {
    }
```

<!-- official: https://github.com/embabel/java-agent-template/blob/main/src/main/java/com/embabel/template/injected/InjectedDemo.java -->
```java
        return ai
                .withDefaultLlm()
                .withId("invent-animal")
                .creating(Animal.class)
                .withExample("good example", new Animal("Fluffox", "Magicox"))
                .withExample("bad example: does not pass validation", new Animal("Sparky", "Dragon"))
                .fromPrompt("""
```

## Persistent domain objects

Domain objects may be JPA entities or loaded through Spring Data repositories. Embabel does not mandate persistence; it recommends familiar JVM technology (Spring Data) and notes that unannotated methods on entities are never exposed to an LLM, so state the model must not see stays hidden. See [TOOLS.md](TOOLS.md#domain-objects-as-tools).

## Output types worth implementing

For agent results that are shown to people, implementing `HasContent` (a `getContent()` string) and `Timestamped` (a `getTimestamp()`) from `com.embabel.agent.domain.library` and `com.embabel.common.core.types` lets shells and UIs render them. The official template's `ReviewedStory` does this.
