package {{package}}.cookbook;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.core.AgentProcessStatusCode;
import com.embabel.agent.domain.io.UserInput;
import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest;
import {{package}}.cookbook.RoutingAgent.Classification;
import {{package}}.cookbook.RoutingAgent.Reply;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RoutingAgentIntegrationTest extends EmbabelMockitoIntegrationTest {

    @BeforeAll
    static void disableInteractiveShell() {
        System.setProperty("embabel.agent.shell.interactive.enabled", "false");
    }

    private Reply invoke(String text) {
        return AgentInvocation.create(agentPlatform, Reply.class).invoke(new UserInput(text));
    }

    @Test
    void refundMessagesTakeTheRefundBranchOnly() {
        whenCreateObject(prompt -> prompt.contains("Classify this message"), Classification.class)
                .thenReturn(new Classification("refund"));
        whenGenerateText(prompt -> prompt.contains("refund confirmation")).thenReturn("Refund approved.");

        var reply = invoke("I want my money back");

        assertThat(reply.text()).isEqualTo("Refund approved.");
        verifyCreateObjectMatching(prompt -> prompt.contains("Classify this message"), Classification.class,
                llm -> llm.getLlm().getTemperature() == 0.0);
        verifyGenerateTextMatching(prompt -> prompt.contains("refund confirmation"));
        verifyNoMoreInteractions(); // the question handler never ran
    }

    @Test
    void questionsTakeTheQuestionBranchOnly() {
        whenCreateObject(prompt -> prompt.contains("Classify this message"), Classification.class)
                .thenReturn(new Classification("question"));
        whenGenerateText(prompt -> prompt.contains("Answer this question")).thenReturn("Mon-Fri, 9 to 5.");

        var reply = invoke("When are you open?");

        assertThat(reply.text()).isEqualTo("Mon-Fri, 9 to 5.");
        verifyCreateObjectMatching(prompt -> prompt.contains("Classify this message"), Classification.class,
                llm -> llm.getLlm().getTemperature() == 0.0);
        verifyGenerateTextMatching(prompt -> prompt.contains("Answer this question"));
        verifyNoMoreInteractions();
    }

    @Test
    void anUnknownCategoryLeavesThePlanStuck() {
        whenCreateObject(prompt -> prompt.contains("Classify this message"), Classification.class)
                .thenReturn(new Classification("complaint"));

        // route() returned null, so no Intent exists and no handler can run.
        var process = AgentInvocation.create(agentPlatform, Reply.class).run(new UserInput("Your service is slow"));

        assertThat(process.getStatus()).isEqualTo(AgentProcessStatusCode.STUCK);
    }
}
