package {{package}}.agent

import com.embabel.agent.api.annotation.AchievesGoal
import com.embabel.agent.api.annotation.Action
import com.embabel.agent.api.annotation.Agent
import com.embabel.agent.api.annotation.Export
import com.embabel.agent.api.common.Ai
import com.embabel.agent.domain.io.UserInput
import com.embabel.common.ai.model.LlmOptions
import {{package}}.domain.Briefing
import {{package}}.domain.BriefingRequest
import {{package}}.domain.Facts
import {{package}}.tools.ClockTools

/**
 * Type-driven flow, inferred by the planner from the function signatures:
 * UserInput -> BriefingRequest -> Facts -> Briefing (goal).
 */
@Agent(description = "Turns a free-text request into a short, dated briefing")
class {{AgentName}}Agent(private val clockTools: ClockTools) {

    @Action
    fun extractRequest(userInput: UserInput, ai: Ai): BriefingRequest =
        ai.withLlm(LlmOptions.withAutoLlm().withTemperature(0.0)) // extraction: be deterministic
            .creating(BriefingRequest::class.java)
            .fromPrompt(
                """
                Extract the briefing topic and the intended audience from the request below.
                If no audience is given, use "general readers".

                # Request
                ${userInput.content}
                """.trimIndent()
            )

    @Action
    fun gatherFacts(request: BriefingRequest, ai: Ai): Facts =
        ai.withLlm(LlmOptions.withAutoLlm().withTemperature(0.2))
            .withToolObject(clockTools) // the LLM may call today()
            .creating(Facts::class.java)
            .fromPrompt(
                """
                List up to five short, verifiable facts about the topic below.
                Use the date tool if the date matters.

                # Topic
                ${request.topic}
                """.trimIndent()
            )

    @AchievesGoal(
        description = "A short briefing has been written for the requested audience",
        export = Export(remote = true, name = "writeBriefing"),
    )
    @Action
    fun writeBriefing(request: BriefingRequest, facts: Facts, ai: Ai): Briefing {
        val markdown = ai.withLlm(LlmOptions.withAutoLlm().withTemperature(0.7)) // writing: allow some creativity
            .generateText(
                """
                Write a briefing in Markdown, under 150 words.
                Audience: ${request.audience}
                Topic: ${request.topic}

                # Facts to use
                ${facts.asBulletList()}
                """.trimIndent()
            )
        return Briefing(markdown)
    }
}
