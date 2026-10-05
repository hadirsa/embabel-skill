# Tools: letting an LLM call your code

A tool is a capability the LLM may invoke during a prompt. Embabel has three kinds. Pick the lightest that works.

| Kind | Use when | How |
|------|----------|-----|
| **Tool object** (in-process) | The LLM should call your own Java methods | `@LlmTool` methods + `withToolObject(obj)` |
| **Tool group** | You want a named bundle, such as web search | `withToolGroup(CoreToolGroups.WEB)` |
| **MCP / subagent** | The capability lives outside the JVM or is another agent | MCP servers, `Subagent` (see the official guide) |

## Tool objects with `@LlmTool`

```java
    @LlmTool(description = "Returns today's date in ISO-8601 format (yyyy-MM-dd)")
    public String today() {
```

Attach the object to a specific LLM call:

```java
                .withToolObject(clockTools) // the LLM may call today()
```

Rules, all verified by `DomainToolsAgentTest` in the cookbook:

- Only methods annotated `@LlmTool` are exposed, whatever their visibility. `AccountTools.close()` is not annotated and never reaches the LLM.
- An object's tools are offered only for the prompts where you call `withToolObject(...)`. Tools are per call, not global.
- `@LlmTool` attributes: `description` (what the LLM reads when deciding), `name` (defaults to the method name), `returnDirect`, `category`, `metadata`. Annotate parameters with `@LlmTool.Param(description = ..., required = ...)` to give the model a clearer schema.

```java
    @LlmTool(description = "Converts a USD amount to euros at a fixed demo rate")
    public double toEuros(@LlmTool.Param(description = "Amount in USD") double usd) {
```

- The annotation Spring AI provides (`org.springframework.ai.tool.annotation.Tool`) is also accepted. Prefer `@LlmTool` in new code.
- Parameters and return values must be serializable. Not supported: `Optional`, async types (`CompletableFuture`), reactive types (`Mono`, `Flux`), functional types.
- A tool call returns a `Tool.Result`. In the cookbook test, calling `toEuros` with 100 USD returns `Tool.Result.WithArtifact("90.0", 90.0)`: the text the LLM sees plus the raw value.

## Domain objects as tools

Putting `@LlmTool` on methods of your domain objects keeps behaviour with the data and lets the object hide state the LLM must never see. The official design advice: expose methods that are *safely invocable*, for example calculations and read-only lookups, and think carefully before exposing anything that mutates state or has side effects. Business rules in `@LlmTool` methods also stop the model getting arithmetic wrong.

## Tool descriptions are prompts

The model chooses tools from their descriptions. State what the tool returns and in what units, and mention when to prefer it over another tool. If a prompt needs a tool, say so in the prompt ("use the date tool if the date matters"), as the scaffold's `gatherFacts` does.

## Tool groups and MCP

Tool groups are named in configuration and referenced by role, for example `CoreToolGroups.WEB`. A tool group is available only if it is configured in your environment, so an action that needs one should fail loudly in tests rather than silently run without it. MCP servers (including Docker Desktop's MCP gateway) feed tool groups; the examples activate Docker Desktop with `app.setAdditionalProfiles(McpServers.DOCKER_DESKTOP)`.

To expose *your* agent to MCP clients, add the `embabel-agent-starter-mcpserver` dependency and mark the goal `@Export(remote = true)`.

## Binding results from inside a tool

A tool can put objects on the process blackboard for later actions (from the Tools page of the guide, "In Process Tools"):

<!-- official: https://docs.embabel.com/embabel-agent/guide/1.5.2/ -->
```java
@LlmTool(description = "My Tool")
public String bindCustomer(Long id) {
    var customer = customerRepository.findById(id);
    var agentProcess = AgentProcess.get();
    if (agentProcess != null) {
        agentProcess.addObject(customer);
        return "Customer bound to blackboard";
    }
    return "No agent process: Unable to bind customer";
}
```

## Testing tools

Assert on the tool names attached to a call, and call the tool directly:

```java
        var tools = promptRunner.getLlmInvocations().getFirst().getInteraction().getTools();
        assertThat(tools).extracting(tool -> tool.getDefinition().getName())
                .containsExactlyInAnyOrder("availableCredit", "toEuros"); // close() is not exposed
```

## Further reading

The official guide's Tools page also covers `Subagent` handoffs, agentic tools (`SimpleAgenticTool`, `PlaybookTool`, `StateMachineTool`), `UnfoldingTool` for large tool sets, tool decoration, and passing out-of-band context with `ToolCallContext`.
