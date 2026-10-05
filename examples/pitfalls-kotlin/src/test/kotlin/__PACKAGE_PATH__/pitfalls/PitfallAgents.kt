package {{package}}.pitfalls

import com.embabel.agent.api.annotation.AchievesGoal
import com.embabel.agent.api.annotation.Action
import com.embabel.agent.api.annotation.Agent
import com.embabel.agent.api.annotation.Condition
import com.embabel.agent.api.common.Ai
import com.embabel.agent.domain.io.UserInput
import org.springframework.context.annotation.Profile

// Deliberately broken Kotlin agents. The "pitfalls" profile keeps them out of every other test.

data class Alert(val text: String)
data class Page(val text: String)

/** The condition is used in pre but never declared in post, so the planner never counts on it. */
@Profile("pitfalls")
@Agent(description = "Pages someone for an alert, but forgot to declare the post-condition")
class KotlinConditionPitfallAgent {

    @Action
    fun detect(userInput: UserInput, ai: Ai): Alert =
        ai.withDefaultLlm().creating(Alert::class.java).fromPrompt("Describe the alert: ${userInput.content}")

    @Condition(name = "alwaysTrue")
    fun alwaysTrue(alert: Alert): Boolean = true

    @AchievesGoal(description = "Someone was paged")
    @Action(pre = ["alwaysTrue"])
    fun page(alert: Alert): Page = Page(alert.text)
}

data class Outline(val text: String)
data class Research(val text: String)
data class Report(val text: String)

/** Outline needs Research and Research needs Outline: neither can run. */
@Profile("pitfalls")
@Agent(description = "Writes a report, but its steps wait for each other")
class KotlinCyclePitfallAgent {

    @Action
    fun outline(userInput: UserInput, research: Research): Outline = Outline(research.text)

    @Action
    fun research(outline: Outline): Research = Research(outline.text)

    @AchievesGoal(description = "A report has been written")
    @Action
    fun write(outline: Outline, research: Research): Report = Report(outline.text + research.text)
}
