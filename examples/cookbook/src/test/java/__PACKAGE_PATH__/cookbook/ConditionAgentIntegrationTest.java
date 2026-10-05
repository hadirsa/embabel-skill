package {{package}}.cookbook;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.core.AgentProcessStatusCode;
import com.embabel.agent.domain.io.UserInput;
import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest;
import {{package}}.cookbook.ConditionAgent.Escalation;
import {{package}}.cookbook.ConditionAgent.Ticket;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ConditionAgentIntegrationTest extends EmbabelMockitoIntegrationTest {

    @BeforeAll
    static void disableInteractiveShell() {
        System.setProperty("embabel.agent.shell.interactive.enabled", "false");
    }

    @Test
    void urgentTicketsAreEscalated() {
        whenCreateObject(prompt -> prompt.contains("Rate the severity"), Ticket.class)
                .thenReturn(new Ticket("Database is down", 5));

        var escalation = AgentInvocation.create(agentPlatform, Escalation.class)
                .invoke(new UserInput("Database is down"));

        assertThat(escalation.note()).isEqualTo("Escalated: Database is down");
    }

    @Test
    void nonUrgentTicketsLeaveTheProcessStuck() {
        whenCreateObject(prompt -> prompt.contains("Rate the severity"), Ticket.class)
                .thenReturn(new Ticket("Typo on the website", 1));

        var process = AgentInvocation.create(agentPlatform, Escalation.class)
                .run(new UserInput("Typo on the website"));

        assertThat(process.getStatus()).isEqualTo(AgentProcessStatusCode.STUCK);
    }
}
