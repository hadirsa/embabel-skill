package {{package}}.tools;

import com.embabel.agent.api.annotation.LlmTool;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;

/**
 * A tool object. Only methods annotated with @LlmTool are visible to an LLM,
 * and only for prompts where the object is added with withToolObject(...).
 */
@Component
public class ClockTools {

    private final Clock clock = Clock.systemUTC();

    @LlmTool(description = "Returns today's date in ISO-8601 format (yyyy-MM-dd)")
    public String today() {
        return LocalDate.now(clock).toString();
    }
}
