# {{projectName}}

An [Embabel](https://github.com/embabel/embabel-agent) agent application ({{language}}, Spring Boot, {{buildTool}}).

## Run the tests (no API key needed)

```bash
{{testCommand}}
```

Unit tests use a fake LLM context; the integration test runs the whole agent flow with the LLM mocked; `AgentPlanTest` fails if any agent's plan can never reach its goal.

## Try the agent

```bash
cp .env.sample .env        # add the key for your provider
set -a; source .env; set +a
{{runCommand}}
```

{{buildTool}} picks the provider from the exported variables: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_CUSTOM_API_KEY` with `OPENAI_CUSTOM_BASE_URL` for any OpenAI-compatible endpoint (also uncomment `embabel.models.default-llm` in `application.yml`). For local models: `{{ollamaRunCommand}}`.

In the shell that opens, run the agent and watch the prompts and responses:

```text
x "Brief the city council on solar energy" -p -r
```

## How it is organized

| Path | Purpose |
|------|---------|
| `agent/` | `@Agent` classes: actions that call LLMs or plain code, and one goal |
| `domain/` | Immutable types (records / data classes) that are the typed inputs and outputs of actions (they drive planning) |
| `tools/` | Classes with `@LlmTool` methods the LLM may call |

See [AGENTS.md](AGENTS.md) for the conventions to follow when changing the agent.
