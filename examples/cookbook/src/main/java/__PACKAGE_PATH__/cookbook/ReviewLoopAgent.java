package {{package}}.cookbook;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.common.ActionContext;
import com.embabel.agent.api.common.workflow.loop.RepeatUntilAcceptableBuilder;
import com.embabel.agent.api.common.workflow.loop.TextFeedback;
import com.embabel.agent.domain.io.UserInput;

/** A writer/reviewer loop packaged as one atomic action with the RepeatUntilAcceptable builder. */
@Agent(description = "Keeps rewriting until the reviewer is satisfied")
public class ReviewLoopAgent {

    public record Story(String text) {
    }

    @AchievesGoal(description = "A story good enough for the reviewer exists")
    @Action
    public Story rewriteUntilSatisfied(UserInput userInput, ActionContext actionContext) {
        var promptRunner = actionContext.ai().withDefaultLlm();
        return RepeatUntilAcceptableBuilder
                .returning(Story.class)
                .withMaxIterations(5)
                .withScoreThreshold(.8)
                .repeating(context -> {
                    var lastAttempt = context.lastAttempt();
                    var feedback = lastAttempt != null ? "Feedback to address: " + lastAttempt.getFeedback() : "";
                    return promptRunner.createObject(
                            "Write a story about: " + userInput.getContent() + "\n" + feedback,
                            Story.class);
                })
                .withEvaluator(context -> promptRunner.createObject(
                        "Score this story from 0 to 1 and explain briefly:\n" + context.getResultToEvaluate(),
                        TextFeedback.class))
                .build()
                .asSubProcess(actionContext, Story.class);
    }
}
