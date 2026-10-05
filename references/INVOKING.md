# Running and invoking agents

## From code (how applications really call agents)

Ask for the type you want; Embabel finds the agent whose goal produces it and plans from the inputs you pass.

```java
        var briefing = AgentInvocation
                .create(agentPlatform, Briefing.class)
                .invoke(new UserInput("Brief the city council on solar energy"));
```

Inject `AgentPlatform` (a Spring bean) wherever you call it.

- `invoke(input...)` returns the goal object. If the process ends without producing it, `invoke` fails with an opaque `NullPointerException`. Use `run(input...)` to get the `AgentProcess` and inspect `getStatus()` (`COMPLETED`, `STUCK`, `FAILED`, `WAITING`, ...). See [TEST.md](TEST.md#test-the-failure-path-too-run-and-stuck).
- `invokeAsync(...)` and `runAsync(...)` return a `CompletableFuture`.
- Pass typed inputs directly (`invoke(request)` for an agent whose first action takes `TravelRequest`) or a `Map<String, Object>` of named inputs.
- Options such as verbosity and budget are configured with `ProcessOptions` via `withProcessOptions(...)`.
- Free text: `UserInput` is created from a string and is provided to actions that declare it as a parameter.

## Interactive shell (development)

With `embabel-agent-starter-shell`, `./mvnw spring-boot:run` (or `./gradlew bootRun`) opens a shell. Useful commands (verified in the framework's `ShellCommands`):

| Command | What it does |
|---------|--------------|
| `execute "request"` or `x "request"` | Pick an agent/goal for the request and run it. Add `-p` to log prompts and `-r` to log LLM responses |
| `agents`, `actions`, `goals`, `conditions` | List what is registered |
| `choose-goal "request"` | Show how goals are ranked for a request, without running anything |
| `chat` | Interactive conversation |
| `blackboard` (`bb`) | Inspect the blackboard |
| `models`, `tools` | List models and tool groups |
| `help` | All commands |

`x "..." -p -r` is the fastest way to see what an agent really sent to the model. Running it needs a provider key in the environment.

## As an MCP server

Add `embabel-agent-starter-mcpserver` and export the goal so MCP clients (for example Claude Desktop) can see it:

```java
            export = @Export(remote = true, name = "writeBriefing"))
```

Without `remote = true` the agent is invisible to MCP clients.

## Open vs closed mode

When a request is free text, the platform can choose the agent (open mode) using an LLM ranking of goals; confidence thresholds are set by `embabel.agent.platform.autonomy.*`. When you ask for a specific result type with `AgentInvocation`, there is no selection step. Prefer typed invocation in application code; it is cheaper and deterministic.

## Official sources

The guide's "Invoking Embabel Agents" page, and `DemoShell` in https://github.com/embabel/java-agent-template for programmatic invocation inside a shell command.
