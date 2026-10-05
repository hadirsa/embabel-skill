package {{package}}.cookbook;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.domain.io.UserInput;
import org.springframework.context.annotation.Profile;

/**
 * Test-only agent with a dependency cycle: Outline needs Research and Research needs Outline,
 * so neither can run and the goal is unreachable. It compiles fine.
 */
@Profile("pitfalls")
@Agent(description = "Writes a report, but its steps wait for each other")
class CyclePitfallAgent {

    record Outline(String text) {
    }

    record Research(String text) {
    }

    record Report(String text) {
    }

    @Action
    Outline outline(UserInput userInput, Research research) {
        return new Outline(research.text());
    }

    @Action
    Research research(Outline outline) {
        return new Research(outline.text());
    }

    @AchievesGoal(description = "A report has been written")
    @Action
    Report write(Outline outline, Research research) {
        return new Report(outline.text() + research.text());
    }
}
