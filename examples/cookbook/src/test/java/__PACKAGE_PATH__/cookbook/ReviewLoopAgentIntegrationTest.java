package {{package}}.cookbook;

import com.embabel.agent.api.common.workflow.loop.TextFeedback;
import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.domain.io.UserInput;
import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest;
import {{package}}.cookbook.ReviewLoopAgent.Story;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ReviewLoopAgentIntegrationTest extends EmbabelMockitoIntegrationTest {

    @BeforeAll
    static void disableInteractiveShell() {
        System.setProperty("embabel.agent.shell.interactive.enabled", "false");
    }

    @Test
    void rewritesUntilTheReviewerScoreReachesTheThreshold() {
        var first = new Story("A first, thin draft.");
        var second = new Story("A richer second draft.");
        whenCreateObject(prompt -> prompt.contains("Write a story about"), Story.class)
                .thenReturn(first, second);
        whenCreateObject(prompt -> prompt.contains("Score this story"), TextFeedback.class)
                .thenReturn(new TextFeedback(0.3, "Needs more detail"), new TextFeedback(0.9, "Good"));

        var story = AgentInvocation.create(agentPlatform, Story.class).invoke(new UserInput("a lighthouse"));

        assertThat(story).isEqualTo(second);
    }
}
