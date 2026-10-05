package {{package}}.cookbook;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.core.hitl.WaitFor;

/**
 * Human in the loop: WaitFor.formSubmission pauses the process until a person fills in a form
 * generated from the record's fields. The entry action takes no parameters, so it runs first.
 */
@Agent(description = "Collects a name from a person, then greets them")
public class FormAgent {

    public record Person(String name) {
    }

    public record Greeting(String text) {
    }

    @Action
    public Person askForName() {
        return WaitFor.formSubmission("Please enter your name", Person.class);
    }

    @AchievesGoal(description = "The person has been greeted")
    @Action
    public Greeting greet(Person person) {
        return new Greeting("Hello, " + person.name());
    }
}
