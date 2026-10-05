package {{package}}.cookbook;

import com.embabel.agent.api.tool.Tool;
import com.embabel.agent.test.unit.FakeOperationContext;
import com.embabel.agent.test.unit.FakePromptRunner;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DomainToolsAgentTest {

    @Test
    void onlyAnnotatedMethodsAreExposedAndTheyWork() {
        var context = FakeOperationContext.create();
        var promptRunner = (FakePromptRunner) context.promptRunner();
        context.expectResponse("The account has plenty of credit.");

        new DomainToolsAgent().explain(new AccountTools("acc-1", 250.0), context.ai());

        var tools = promptRunner.getLlmInvocations().getFirst().getInteraction().getTools();
        assertThat(tools).extracting(tool -> tool.getDefinition().getName())
                .containsExactlyInAnyOrder("availableCredit", "toEuros"); // close() is not exposed

        Tool toEuros = tools.stream().filter(t -> t.getDefinition().getName().equals("toEuros")).findFirst().orElseThrow();
        assertThat(toEuros.call("{\"usd\": 100.0}")).isEqualTo(new Tool.Result.WithArtifact("90.0", 90.0));
        assertThat(toEuros.getDefinition().getInputSchema().toJsonSchema())
                .contains("\"usd\"").contains("Amount in USD");
    }
}
