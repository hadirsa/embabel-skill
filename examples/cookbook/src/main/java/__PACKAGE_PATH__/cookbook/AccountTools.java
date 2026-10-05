package {{package}}.cookbook;

import com.embabel.agent.api.annotation.LlmTool;

/**
 * A domain object with behaviour. Only @LlmTool methods are visible to an LLM, and only when the
 * object is passed to withToolObject(...). Everything else stays private to your code.
 */
public record AccountTools(String id, double balance) {

    @LlmTool(description = "Returns the credit still available on this account, in USD")
    public double availableCredit() {
        return Math.max(0, 1000 - balance);
    }

    @LlmTool(description = "Converts a USD amount to euros at a fixed demo rate")
    public double toEuros(@LlmTool.Param(description = "Amount in USD") double usd) {
        return usd * 0.9;
    }

    /** Not annotated: never exposed, whatever its visibility. */
    public void close() {
    }
}
