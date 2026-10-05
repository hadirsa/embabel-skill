package {{package}}.cookbook;

import com.embabel.agent.api.annotation.AchievesGoal;
import com.embabel.agent.api.annotation.Action;
import com.embabel.agent.api.annotation.Agent;
import com.embabel.agent.api.annotation.State;
import com.embabel.agent.domain.io.UserInput;

/**
 * A state machine with a loop. Returning a @State object moves the plan into that state;
 * clearBlackboard = true lets an action return to a state type it has already visited.
 */
@Agent(description = "Counts through states until a limit, then finishes")
public class LoopStatesAgent {

    public record Result(int rounds) {
    }

    @State
    public interface Outcome {
    }

    @Action
    public Counting begin(UserInput userInput) {
        return new Counting(0);
    }

    public record Counting(int round) implements Outcome {

        @Action(clearBlackboard = true)
        public Outcome tick() {
            return round >= 2 ? new Finished(round) : new Counting(round + 1);
        }
    }

    public record Finished(int rounds) implements Outcome {

        @AchievesGoal(description = "The loop has finished")
        @Action
        public Result finish() {
            return new Result(rounds);
        }
    }
}
