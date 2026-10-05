package {{package}}.agent

import com.embabel.agent.api.invocation.AgentInvocation
import com.embabel.agent.domain.io.UserInput
import com.embabel.agent.test.integration.EmbabelMockitoIntegrationTest
import {{package}}.domain.Briefing
import {{package}}.domain.BriefingRequest
import {{package}}.domain.Facts
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.Test

/**
 * Runs the whole flow under Spring Boot against the real AgentPlatform, with the LLM mocked.
 * It proves that the agent is discovered, that the types chain from UserInput to the goal,
 * and that each step calls the LLM the way we expect.
 */
class {{AgentName}}AgentIntegrationTest : EmbabelMockitoIntegrationTest() {

    companion object {
        @JvmStatic
        @BeforeAll
        fun disableInteractiveShell() {
            System.setProperty("embabel.agent.shell.interactive.enabled", "false")
        }
    }

    @Test
    fun `plan reaches the goal from UserInput`() {
        val request = BriefingRequest("solar energy", "city council")
        val facts = Facts(listOf("Solar capacity grew last year"))

        whenCreateObject({ it.contains("Extract the briefing topic") }, BriefingRequest::class.java)
            .thenReturn(request)
        whenCreateObject({ it.contains("verifiable facts") }, Facts::class.java)
            .thenReturn(facts)
        whenGenerateText { it.contains("Write a briefing in Markdown") }
            .thenReturn("# Solar energy\nShort briefing text.")

        val briefing = AgentInvocation.create(agentPlatform, Briefing::class.java)
            .invoke(UserInput("Brief the city council on solar energy"))

        assertThat(briefing.markdown).contains("Solar energy")
        verifyCreateObjectMatching({ it.contains("Extract the briefing topic") }, BriefingRequest::class.java) {
            it.llm.temperature == 0.0
        }
        verifyCreateObjectMatching({ it.contains("verifiable facts") }, Facts::class.java) {
            it.llm.temperature == 0.2
        }
        verifyGenerateTextMatching { it.contains("Write a briefing in Markdown") }
        verifyNoMoreInteractions()
    }
}
