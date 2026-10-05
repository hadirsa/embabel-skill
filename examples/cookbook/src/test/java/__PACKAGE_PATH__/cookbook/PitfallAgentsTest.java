package {{package}}.cookbook;

import com.embabel.agent.api.invocation.AgentInvocation;
import com.embabel.agent.core.AgentProcessStatusCode;
import com.embabel.agent.domain.io.UserInput;
import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest;
import {{package}}.plan.AgentPlanCheck;
import {{package}}.plan.AgentPlanCheck.Finding;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves two things about deliberately broken agents: they really get stuck at runtime, and
 * AgentPlanCheck reports them before anything runs.
 */
@ActiveProfiles("pitfalls")
class PitfallAgentsTest extends EmbabelMockitoIntegrationTest {

    @BeforeAll
    static void disableInteractiveShell() {
        System.setProperty("embabel.agent.shell.interactive.enabled", "false");
    }

    @Test
    void aPreConditionWithoutAMatchingPostConditionNeverFires() {
        whenCreateObject(prompt -> prompt.contains("Describe the alert"), ConditionPitfallAgent.Alert.class)
                .thenReturn(new ConditionPitfallAgent.Alert("Disk full"));

        var process = AgentInvocation.create(agentPlatform, ConditionPitfallAgent.Page.class)
                .run(new UserInput("Disk full"));

        // The condition is true, but because no action declares it in post, the planner never counts on it.
        assertThat(process.getStatus()).isEqualTo(AgentProcessStatusCode.STUCK);
    }

    @Test
    void theCheckerReportsBothPitfallsAndNothingElse() {
        var findings = AgentPlanCheck.check(agentPlatform, "{{package}}");
        System.out.println(AgentPlanCheck.report(findings));

        assertThat(AgentPlanCheck.errors(findings))
                .extracting(Finding::agent, Finding::code)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple("ConditionPitfallAgent", "CONDITION_NEVER_SET"),
                        org.assertj.core.groups.Tuple.tuple("ConditionPitfallAgent", "UNREACHABLE_GOAL"),
                        org.assertj.core.groups.Tuple.tuple("CyclePitfallAgent", "UNREACHABLE_GOAL"));
    }
}
