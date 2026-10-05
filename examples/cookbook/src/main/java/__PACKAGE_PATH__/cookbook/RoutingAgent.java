package {{package}}.cookbook;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.Ai;
import com.embabel.agent.domain.io.UserInput;
import com.embabel.common.ai.model.LlmOptions;

/**
 * Routing by subtype: an action returns a supertype (Intent); only the handler whose parameter
 * matches the concrete subtype that was actually returned can run. Returning null replans.
 */
@Agent(description = "Routes a support message to the right handler and replies")
public class RoutingAgent {

    public record Classification(String category) {
    }

    public sealed interface Intent permits Refund, Question {
    }

    public record Refund(String reason) implements Intent {
    }

    public record Question(String text) implements Intent {
    }

    public record Draft(String text) {
    }

    public record Reply(String text) {
    }

    @Action
    public Classification classify(UserInput userInput, Ai ai) {
        return ai
                .withLlm(LlmOptions.withAutoLlm().withTemperature(0.0))
                .creating(Classification.class)
                .fromPrompt("Classify this message as 'refund' or 'question': " + userInput.getContent());
    }

    @Action
    public Intent route(Classification classification, UserInput userInput) {
        return switch (classification.category()) {
            case "refund" -> new Refund(userInput.getContent());
            case "question" -> new Question(userInput.getContent());
            default -> null; // unknown category: nothing is produced, the planner replans
        };
    }

    @Action
    public Draft handleRefund(Refund refund, Ai ai) {
        return new Draft(ai.withDefaultLlm().generateText("Write a refund confirmation for: " + refund.reason()));
    }

    @Action
    public Draft handleQuestion(Question question, Ai ai) {
        return new Draft(ai.withDefaultLlm().generateText("Answer this question briefly: " + question.text()));
    }

    @AchievesGoal(description = "A reply is ready to send")
    @Action
    public Reply send(Draft draft) {
        return new Reply(draft.text());
    }
}
