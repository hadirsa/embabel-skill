# Calling LLMs from actions

All LLM calls go through `Ai` (injected as an action parameter) and the `PromptRunner` it returns. Everything here is exercised by the scaffold and its tests.

## Choosing the model

```java
ai.withLlm(LlmOptions.withAutoLlm().withTemperature(0.0))
```

| Call | Meaning |
|------|---------|
| `ai.withDefaultLlm()` | The configured default (`embabel.models.default-llm`) |
| `ai.withAutoLlm()` | Let the platform choose |
| `ai.withLlmByRole("best")` | A role you define in configuration, e.g. `best` / `cheapest` |
| `ai.withLlm("model-name")` | A specific model |
| `ai.withLlm(LlmOptions...)` | Model plus hyperparameters |

`LlmOptions` is fluent: `withModel(String)`, `withRole(String)`, `withTemperature(Double)`, `withTopP(Double)`, `withTopK(Integer)`, `withPersona(String)`; `LlmOptions.withAutoLlm()` starts from automatic selection. Roles are declared as `embabel.models.llms.<role>=<model-name>`; see [CONFIGURATION.md](CONFIGURATION.md).

### Temperature by job

The scaffold shows the habit worth copying: set it deliberately, per action.

| Job | Temperature |
|-----|-------------|
| Extraction, classification, routing | `0.0` |
| Factual summaries, tool-using research | around `0.2` |
| Creative writing | `0.7` or higher |

Caveat from an official example: some newer OpenAI models reject a custom temperature and accept only their default. If a call fails on a model for that reason, drop `withTemperature` for that model rather than switching away from it.

## Getting output

Typed object (preferred whenever the next action needs structure):

```java
        return ai
                .withLlm(LlmOptions.withAutoLlm().withTemperature(0.0)) // extraction: be deterministic
                .creating(BriefingRequest.class)
                .fromPrompt("""
```

Plain text, when the result is prose:

```java
        var markdown = ai
                .withLlm(LlmOptions.withAutoLlm().withTemperature(0.7)) // writing: allow some creativity
                .generateText("""
```

Equivalent older spelling that still appears in the docs and examples: `promptRunner.createObject(prompt, Type.class)`. `createObjectIfPossible(prompt, Type.class)` returns `null` on failure, which triggers replanning (see [ACTIONS.md](ACTIONS.md#return-types)); `createObject` throws instead, and an exception triggers a retry and then replanning.

Related `creating(...)` options, from `PromptRunner.Creating`: `withExample(...)`, `withExamples(...)`, `withValidation(...)` / `withoutValidation()`, `withFieldFilter(...)`, `withProperties(...)`, `withoutProperties(...)`. Bean Validation annotations on the target record (for example `@Pattern`) are applied to what the LLM returns; see [DOMAIN-MODEL.md](DOMAIN-MODEL.md).

## Writing prompts that survive refactoring

- Put the user's text inside the prompt explicitly (`userInput.getContent()`); the LLM sees only what you pass.
- Separate instructions from data with headings or XML-style tags so data cannot be mistaken for instructions.
- State the output expectations (length, format, fallback such as `If no audience is given, use "general readers"`).
- Pass earlier results as text built from typed objects (see `Facts.asBulletList()`), not by dumping `toString()`.
- Keep each action's prompt to one job. Smaller prompts are easier to test and let you mix models.
- Keep prompt text assertable: tests check `contains(...)` on distinctive phrases, so keep those phrases stable. See [TEST.md](TEST.md).

## Personas and prompt contributors

A persona gives the model a consistent role. They plug in with `withPromptContributor(...)`.

<!-- official: https://github.com/embabel/java-agent-template/blob/main/src/main/java/com/embabel/template/agent/WriteAndReviewAgent.java -->
```java
    static final RoleGoalBackstory WRITER = new RoleGoalBackstory(
            "Creative Storyteller",
            "Write engaging and imaginative stories",
            "Has a PhD in French literature; used to work in a circus");

    static final Persona REVIEWER = new Persona(
            "Media Book Review",
            "New York Times Book Reviewer",
            "Professional and insightful",
            "Help guide readers toward good stories"
    );
```

## Interaction ids

`.withId("classify-intent")` names an interaction so it is easy to find in logs and assert on in tests.

## Prompts in files

The template reserves `src/main/resources/prompts/` for prompt templates rendered via `PromptRunner.rendering("templateName")`. Reach for it once prompts grow past a screen of text; start inline.
