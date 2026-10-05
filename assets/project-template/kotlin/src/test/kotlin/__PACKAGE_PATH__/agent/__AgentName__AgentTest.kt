package {{package}}.agent

import com.embabel.agent.domain.io.UserInput
import com.embabel.agent.test.unit.FakeOperationContext
import com.embabel.agent.test.unit.FakePromptRunner
import {{package}}.domain.BriefingRequest
import {{package}}.domain.Facts
import {{package}}.tools.ClockTools
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

/**
 * Unit tests call action methods directly with a fake context: no Spring, no LLM, no network.
 * They pin down what matters about each LLM call: the prompt content, the temperature, the tools.
 */
class {{AgentName}}AgentTest {

    private val agent = {{AgentName}}Agent(ClockTools())

    @Test
    fun `extractRequest prompt contains the user input and is deterministic`() {
        val context = FakeOperationContext.create()
        val promptRunner = context.promptRunner() as FakePromptRunner
        val expected = BriefingRequest("solar energy", "city council")
        context.expectResponse(expected)

        val result = agent.extractRequest(UserInput("Brief the city council on solar energy"), context.ai())

        assertThat(result).isEqualTo(expected)
        val invocation = promptRunner.llmInvocations.first()
        assertThat(invocation.prompt).contains("city council on solar energy")
        assertThat(invocation.interaction.llm.temperature).isEqualTo(0.0)
    }

    @Test
    fun `gatherFacts offers the clock tool`() {
        val context = FakeOperationContext.create()
        val promptRunner = context.promptRunner() as FakePromptRunner
        context.expectResponse(Facts(listOf("Solar capacity grew last year")))

        val facts = agent.gatherFacts(BriefingRequest("solar energy", "city council"), context.ai())

        assertThat(facts.items).hasSize(1)
        val invocation = promptRunner.llmInvocations.first()
        assertThat(invocation.prompt).contains("solar energy")
        assertThat(invocation.interaction.tools.map { it.definition.name }).contains("today")
    }

    @Test
    fun `writeBriefing uses facts and audience`() {
        val context = FakeOperationContext.create()
        val promptRunner = context.promptRunner() as FakePromptRunner
        context.expectResponse("# Solar energy\nShort briefing text.")

        val briefing = agent.writeBriefing(
            BriefingRequest("solar energy", "city council"),
            Facts(listOf("Fact one", "Fact two")),
            context.ai(),
        )

        assertThat(briefing.wordCount()).isPositive()
        val prompt = promptRunner.llmInvocations.first().prompt
        assertThat(prompt).contains("city council").contains("- Fact one").contains("- Fact two")
    }
}
