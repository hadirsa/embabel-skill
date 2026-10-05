package {{package}}.cookbook;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.annotation.Condition;
import com.embabel.agent.api.common.Ai;
import com.embabel.agent.domain.io.UserInput;
import org.springframework.context.annotation.Profile;

/**
 * Test-only agent that demonstrates a pitfall: the pre-condition "alwaysTrue" is never declared in
 * post = {...} by any action, so the planner never counts on it and the goal is unreachable.
 * (It lives in the test sources: Spring Boot does not scan classes nested inside test classes.
 * The "pitfalls" profile keeps it out of every test except PitfallAgentsTest.)
 */
@Profile("pitfalls")
@Agent(description = "Pages someone for an alert, but forgot to declare the post-condition")
class ConditionPitfallAgent {

    record Alert(String text) {
    }

    record Page(String text) {
    }

    @Action
    Alert detect(UserInput userInput, Ai ai) {
        return ai.withDefaultLlm().creating(Alert.class).fromPrompt("Describe the alert: " + userInput.getContent());
    }

    @Condition(name = "alwaysTrue")
    boolean alwaysTrue(Alert alert) {
        return true;
    }

    @AchievesGoal(description = "Someone was paged")
    @Action(pre = {"alwaysTrue"})
    Page page(Alert alert) {
        return new Page(alert.text());
    }
}
