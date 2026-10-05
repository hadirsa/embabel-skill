package {{package}}.agent;

import com.embabel.agent.domain.io.UserInput;
import com.embabel.agent.test.unit.FakeOperationContext;
import com.embabel.agent.test.unit.FakePromptRunner;
import {{package}}.domain.Briefing;
import {{package}}.domain.BriefingRequest;
import {{package}}.domain.Facts;
import {{package}}.tools.ClockTools;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests call action methods directly with a fake context: no Spring, no LLM, no network.
 * They pin down what matters about each LLM call: the prompt content, the temperature, the tools.
 */
class {{AgentName}}AgentTest {

    private final {{AgentName}}Agent agent = new {{AgentName}}Agent(new ClockTools());

    @Test
    void extractRequestPromptContainsUserInputAndIsDeterministic() {
        var context = FakeOperationContext.create();
        var promptRunner = (FakePromptRunner) context.promptRunner();
        var expected = new BriefingRequest("solar energy", "city council");
        context.expectResponse(expected);

        var result = agent.extractRequest(new UserInput("Brief the city council on solar energy"), context.ai());

        assertThat(result).isEqualTo(expected);
        var invocation = promptRunner.getLlmInvocations().getFirst();
        assertThat(invocation.getPrompt()).contains("city council on solar energy");
        assertThat(invocation.getInteraction().getLlm().getTemperature()).isEqualTo(0.0);
    }

    @Test
    void gatherFactsOffersTheClockTool() {
        var context = FakeOperationContext.create();
        var promptRunner = (FakePromptRunner) context.promptRunner();
        context.expectResponse(new Facts(List.of("Solar capacity grew last year")));

        var facts = agent.gatherFacts(new BriefingRequest("solar energy", "city council"), context.ai());

        assertThat(facts.items()).hasSize(1);
        var invocation = promptRunner.getLlmInvocations().getFirst();
        assertThat(invocation.getPrompt()).contains("solar energy");
        assertThat(invocation.getInteraction().getTools())
                .extracting(tool -> tool.getDefinition().getName())
                .contains("today");
    }

    @Test
    void writeBriefingUsesFactsAndAudience() {
        var context = FakeOperationContext.create();
        var promptRunner = (FakePromptRunner) context.promptRunner();
        context.expectResponse("# Solar energy\nShort briefing text.");

        var briefing = agent.writeBriefing(
                new BriefingRequest("solar energy", "city council"),
                new Facts(List.of("Fact one", "Fact two")),
                context.ai());

        assertThat(briefing).isInstanceOf(Briefing.class);
        assertThat(briefing.wordCount()).isPositive();
        var prompt = promptRunner.getLlmInvocations().getFirst().getPrompt();
        assertThat(prompt).contains("city council").contains("- Fact one").contains("- Fact two");
    }
}
