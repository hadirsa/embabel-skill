package {{package}}.cookbook;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.domain.io.UserInput;
import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest;
import {{package}}.cookbook.LoopStatesAgent.Result;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoopStatesAgentIntegrationTest extends EmbabelMockitoIntegrationTest {

    @BeforeAll
    static void disableInteractiveShell() {
        System.setProperty("embabel.agent.shell.interactive.enabled", "false");
    }

    @Test
    void theLoopRunsUntilTheStateMachineFinishes() {
        var result = AgentInvocation.create(agentPlatform, Result.class).invoke(new UserInput("go"));

        assertThat(result.rounds()).isEqualTo(2);
    }
}
