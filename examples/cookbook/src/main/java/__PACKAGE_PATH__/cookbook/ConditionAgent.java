package {{package}}.cookbook;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.annotation.Condition;
import com.embabel.agent.api.common.Ai;
import com.embabel.agent.domain.io.UserInput;

/**
 * A custom condition gates an action. Condition methods are evaluated while planning, so they
 * must be free of side effects. The action that produces the data a condition inspects declares
 * the condition in post = {...}; without it the planner assumes the condition is never set.
 */
@Agent(description = "Escalates urgent tickets")
public class ConditionAgent {

    public record Ticket(String text, int severity) {
    }

    public record Escalation(String note) {
    }

    @Action(post = {"urgent"})
    public Ticket assess(UserInput userInput, Ai ai) {
        return ai.withDefaultLlm().creating(Ticket.class)
                .fromPrompt("Rate the severity 1-5 of this ticket: " + userInput.getContent());
    }

    @Condition(name = "urgent")
    public boolean urgent(Ticket ticket) {
        return ticket.severity() >= 4;
    }

    @AchievesGoal(description = "An urgent ticket has been escalated")
    @Action(pre = {"urgent"})
    public Escalation escalate(Ticket ticket) {
        return new Escalation("Escalated: " + ticket.text());
    }
}
