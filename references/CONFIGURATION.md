# Dependencies and configuration

## Dependencies

Embabel is a Spring Boot application framework. Every `com.embabel.agent` artifact must use **one** version, set once in the POM:

```xml
        <embabel-agent.version>{{embabelAgentVersion}}</embabel-agent.version>
```

| Artifact | Purpose |
|----------|---------|
| `embabel-agent-starter` | The platform: agents, planning, `Ai`. Always |
| `embabel-agent-starter-shell` | Interactive shell for local runs |
| `embabel-agent-test` (test scope) | Fakes and `EmbabelMockitoIntegrationTest` |
| `embabel-agent-starter-mcpserver` | Expose agents to MCP clients |
| `embabel-agent-starter-a2a` | Agent-to-agent protocol |
| `embabel-agent-starter-webmvc` | Spring MVC controllers |
| `embabel-agent-starter-observability` | Observability |
| `embabel-agent-starter-jdbc` | JDBC-backed agent process persistence |

**Provider starters** (add the ones you use): `-openai`, `-anthropic`, `-gemini`, `-google-genai`, `-bedrock`, `-mistral-ai`, `-deepseek`, `-ollama`, `-lmstudio`, `-dockermodels`, `-onnx`, `-oci-genai`, `-dashscope`, `-minimax`, `-zai`, `-openai-custom`, `-byok`.

The scaffold selects a provider at build time. With Maven, the profiles `openai-models`, `anthropic-models` and `openai-custom-models` activate when `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_CUSTOM_API_KEY` exist in the environment, and `ollama` is opt-in (`./mvnw -Pollama spring-boot:run`). The Gradle build does the same in `build.gradle.kts`: it adds each starter when its variable is set, and Ollama with `./gradlew -Pollama bootRun`. Both read the variables from the environment of the process that runs the build, so a `.env` file is **not** picked up by Maven or Gradle. Load it into the shell first:

```bash
set -a; source .env; set +a
```

The application itself also reads `.env` at startup (`spring.config.import: optional:file:.env[.properties]` in the scaffold's `application.yml`), so a run from an IDE sees the values once the right starter is on the classpath. The file is parsed as Java properties: plain `KEY=VALUE` lines, no `export`, no quotes.

## OpenAI-compatible endpoints

For a gateway, proxy or self-hosted server that speaks the OpenAI API, use `embabel-agent-starter-openai-custom`, not `-openai` (which requires `OPENAI_API_KEY` and targets OpenAI's own models).

```yaml
# Read from the environment by the starter itself; these properties are the fallback
#   OPENAI_CUSTOM_API_KEY, OPENAI_CUSTOM_BASE_URL, OPENAI_CUSTOM_MODELS
embabel:
  agent:
    platform:
      models:
        openai:
          custom:
            models: "${LLM_MODEL:gpt-4o-mini}"
  models:
    default-llm: "${LLM_MODEL:gpt-4o-mini}"
```

| Property (`embabel.agent.platform.models.openai.custom.`) | Env variable (wins when set) | Notes |
|---|---|---|
| `api-key` | `OPENAI_CUSTOM_API_KEY` | Required: startup fails without it once the starter is present |
| `base-url` | `OPENAI_CUSTOM_BASE_URL` | Include `/v1`, for example `https://api.openai.com/v1` |
| `models` | `OPENAI_CUSTOM_MODELS` | Comma-separated. **Only these models are registered** |
| `completions-path`, `embeddings-path` | `OPENAI_CUSTOM_COMPLETIONS_PATH`, `..._EMBEDDINGS_PATH` | For servers that do not use the OpenAI paths |
| `max-attempts`, `backoff-millis`, `backoff-multiplier`, `backoff-max-interval` | | Retries of the calls actions make. Defaults are 10 attempts from 5 s, ×5, up to 180 s, so a dead endpoint looks like a hang; lower them while developing |

Every model an agent asks for (`default-llm`, roles, and any `LlmOptions.withModel(...)`) must appear in `models`. Set `embabel.models.default-llm` too: if it names a model that is not registered (the shipped default usually is not), the application fails at startup with `Default LLM '...' not found`.

Choosing the agent for a free-text request (the shell's `x "..."`) is a separate LLM call, the ranker, with its own retries: `embabel.agent.platform.ranking.max-attempts` (default 5) and `embabel.agent.platform.ranking.llm` to pick its model.

Local check without a key: Ollama serves the same API at `http://127.0.0.1:11434/v1` (any non-empty key works). Use `127.0.0.1`, not `localhost`: Ollama listens on IPv4 only, and the Java client may try IPv6 (`::1`) first and fail with `ConnectException: Connection refused`.

When a project only ever talks to one such endpoint, it is fine to make the starter a plain dependency instead of a profile; then `.env` alone is enough and no export is needed.

## Spring Boot compatibility

Embabel 1.5.x requires **Spring Boot 4.x** (Spring AI 2.x). Spring Boot 3.5.x fails at startup with `ClassNotFoundException: org.springframework.ai.model.tool.autoconfigure.ToolCallingAutoConfiguration`. See [VERSIONS.md](VERSIONS.md).

## Properties

Configuration lives in `src/main/resources/application.yml`, with profile-specific files named `application-<profile>.yml`. Use YAML and do not add an `application.properties` next to it: when both exist, Spring loads both and the `.properties` values win, which is confusing. Quote values that contain `${...}` or start with special characters. Environment variables override either file (`EMBABEL_MODELS_DEFAULT_LLM` for `embabel.models.default-llm`).

The properties below are written in dotted form for brevity; in `application.yml` each dot is a nesting level. The ones you will actually touch:

| Property | Purpose |
|----------|---------|
| `embabel.models.default-llm` | Default model name, or a role. The shipped default is an OpenAI model, so **override it** if you use another provider |
| `embabel.models.llms.<role>` | Map a role such as `best` or `cheapest` to a model name |
| `embabel.models.default-embedding-model` | Default embedding model |
| `embabel.agent.platform.ranking.llm` | Model used to rank which agent/goal fits a free-text request |
| `embabel.agent.logging.personality` | Cosmetic logging theme |
| `embabel.agent.platform.toolloop.max-iterations` | Cap on tool-call rounds per prompt |
| `embabel.agent.platform.llm-operations.data-binding.max-attempts` | Retries when the LLM returns an invalid object |
| `embabel.agent.platform.autonomy.agent-confidence-cut-off`, `...goal-confidence-cut-off` | Minimum confidence for open-mode selection |
| `logging.level.com.embabel.agent` | `DEBUG` shows planning and LLM calls |

Provider-specific and retry settings live under `embabel.agent.platform.models.<provider>.*`. The authoritative, versioned list is the Configuration page of the guide for your version.

Property names have changed between releases (older templates use `embabel.agent-platform.ranking.llm`; current docs use `embabel.agent.platform.ranking.llm`). When a property seems ignored, check the guide for your exact version.

## Secrets

Keys come from the environment only. Commit `.env.sample` with empty values, never `.env`. Do not print, log or paste keys, and do not read `.env` back into a chat or terminal transcript.

## Per-action settings in YAML

`LlmOptions` is deserializable, so models and hyperparameters can be externalised into configuration properties instead of hard-coded in agents. Prefer this once a model choice needs to differ per environment.
