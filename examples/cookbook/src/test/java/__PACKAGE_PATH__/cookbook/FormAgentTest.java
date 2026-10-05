package {{package}}.cookbook;

import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FormAgentTest extends EmbabelMockitoIntegrationTest {

    @BeforeAll
    static void disableInteractiveShell() {
        System.setProperty("embabel.agent.shell.interactive.enabled", "false");
    }

    @Test
    void theAgentIsRegisteredWithThePlatform() {
        assertThat(agentPlatform.agents()).extracting(agent -> agent.getName()).contains("FormAgent");
    }
}
