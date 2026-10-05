package {{package}}.agent;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.domain.io.UserInput;
import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest;
import {{package}}.domain.Briefing;
import {{package}}.domain.BriefingRequest;
import {{package}}.domain.Facts;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs the whole flow under Spring Boot against the real AgentPlatform, with the LLM mocked.
 * It proves that the agent is discovered, that the types chain from UserInput to the goal,
 * and that each step calls the LLM the way we expect.
 */
class {{AgentName}}AgentIntegrationTest extends EmbabelMockitoIntegrationTest {

    @BeforeAll
    static void disableInteractiveShell() {
        System.setProperty("embabel.agent.shell.interactive.enabled", "false");
    }

    @Test
    void planReachesTheGoalFromUserInput() {
        var request = new BriefingRequest("solar energy", "city council");
        var facts = new Facts(List.of("Solar capacity grew last year"));

        whenCreateObject(prompt -> prompt.contains("Extract the briefing topic"), BriefingRequest.class)
                .thenReturn(request);
        whenCreateObject(prompt -> prompt.contains("verifiable facts"), Facts.class)
                .thenReturn(facts);
        whenGenerateText(prompt -> prompt.contains("Write a briefing in Markdown"))
                .thenReturn("# Solar energy\nShort briefing text.");

        var briefing = AgentInvocation
                .create(agentPlatform, Briefing.class)
                .invoke(new UserInput("Brief the city council on solar energy"));

        assertThat(briefing.markdown()).contains("Solar energy");

        verifyCreateObjectMatching(prompt -> prompt.contains("Extract the briefing topic"), BriefingRequest.class,
                llm -> llm.getLlm().getTemperature() == 0.0);
        verifyCreateObjectMatching(prompt -> prompt.contains("verifiable facts"), Facts.class,
                llm -> llm.getLlm().getTemperature() == 0.2);
        verifyGenerateTextMatching(prompt -> prompt.contains("Write a briefing in Markdown"));
        verifyNoMoreInteractions();
    }
}
