package {{package}}.pitfalls

import com.embabel.agent.api.invocation.AgentInvocation
import com.embabel.agent.core.AgentProcessStatusCode
import com.embabel.agent.domain.io.UserInput
import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest
import {{package}}.plan.AgentPlanCheck
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.groups.Tuple.tuple
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test
import org.springframework.test.context.ActiveProfiles

/** The same proof as the Java cookbook, for Kotlin: the pitfalls get stuck, and the checker reports them. */
@ActiveProfiles("pitfalls")
class KotlinPitfallAgentsTest : EmbabelMockitoIntegrationTest() {

    companion object {
        @JvmStatic
        @BeforeAll
        fun disableInteractiveShell() {
            System.setProperty("embabel.agent.shell.interactive.enabled", "false")
        }
    }

    @Test
    fun `a pre-condition without a matching post-condition never fires`() {
        whenCreateObject({ it.contains("Describe the alert") }, Alert::class.java).thenReturn(Alert("Disk full"))

        val process = AgentInvocation.create(agentPlatform, Page::class.java).run(UserInput("Disk full"))

        assertThat(process.status).isEqualTo(AgentProcessStatusCode.STUCK)
    }

    @Test
    fun `the checker reports both Kotlin pitfalls and nothing else`() {
        val findings = AgentPlanCheck.check(agentPlatform, "{{package}}")
        println(AgentPlanCheck.report(findings))

        assertThat(AgentPlanCheck.errors(findings))
            .extracting({ it.agent() }, { it.code() })
            .containsExactlyInAnyOrder(
                tuple("KotlinConditionPitfallAgent", "CONDITION_NEVER_SET"),
                tuple("KotlinConditionPitfallAgent", "UNREACHABLE_GOAL"),
                tuple("KotlinCyclePitfallAgent", "UNREACHABLE_GOAL"),
            )
    }
}
