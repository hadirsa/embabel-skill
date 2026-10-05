package {{package}}.cookbook;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.Ai;

@Agent(description = "Explains an account using its own tools")
public class DomainToolsAgent {

    public record Explanation(String text) {
    }

    @AchievesGoal(description = "The account has been explained")
    @Action
    public Explanation explain(AccountTools account, Ai ai) {
        return new Explanation(
                ai.withDefaultLlm()
                        .withToolObject(account) // the LLM may now call availableCredit() and toEuros()
                        .generateText("Explain the state of account " + account.id() + " using the tools."));
    }
}
