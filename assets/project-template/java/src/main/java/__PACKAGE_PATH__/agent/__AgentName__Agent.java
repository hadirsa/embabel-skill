package {{package}}.agent;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.annotation.Export;
import com.embabel.agent.api.common.Ai;
import com.embabel.agent.domain.io.UserInput;
import com.embabel.common.ai.model.LlmOptions;
import {{package}}.domain.Briefing;
import {{package}}.domain.BriefingRequest;
import {{package}}.domain.Facts;
import {{package}}.tools.ClockTools;

/**
 * Type-driven flow, inferred by the planner from the method signatures:
 * UserInput -> BriefingRequest -> Facts -> Briefing (goal).
 */
@Agent(description = "Turns a free-text request into a short, dated briefing")
public class {{AgentName}}Agent {

    private final ClockTools clockTools;

    public {{AgentName}}Agent(ClockTools clockTools) {
        this.clockTools = clockTools;
    }

    @Action
    public BriefingRequest extractRequest(UserInput userInput, Ai ai) {
        return ai
                .withLlm(LlmOptions.withAutoLlm().withTemperature(0.0)) // extraction: be deterministic
                .creating(BriefingRequest.class)
                .fromPrompt("""
                        Extract the briefing topic and the intended audience from the request below.
                        If no audience is given, use "general readers".

                        # Request
                        %s
                        """.formatted(userInput.getContent()).trim());
    }

    @Action
    public Facts gatherFacts(BriefingRequest request, Ai ai) {
        return ai
                .withLlm(LlmOptions.withAutoLlm().withTemperature(0.2))
                .withToolObject(clockTools) // the LLM may call today()
                .creating(Facts.class)
                .fromPrompt("""
                        List up to five short, verifiable facts about the topic below.
                        Use the date tool if the date matters.

                        # Topic
                        %s
                        """.formatted(request.topic()).trim());
    }

    @AchievesGoal(
            description = "A short briefing has been written for the requested audience",
            export = @Export(remote = true, name = "writeBriefing"))
    @Action
    public Briefing writeBriefing(BriefingRequest request, Facts facts, Ai ai) {
        var markdown = ai
                .withLlm(LlmOptions.withAutoLlm().withTemperature(0.7)) // writing: allow some creativity
                .generateText("""
                        Write a briefing in Markdown, under 150 words.
                        Audience: %s
                        Topic: %s

                        # Facts to use
                        %s
                        """.formatted(request.audience(), request.topic(), facts.asBulletList()).trim());
        return new Briefing(markdown);
    }
}
