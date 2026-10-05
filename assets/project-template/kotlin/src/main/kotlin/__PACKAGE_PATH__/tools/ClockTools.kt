package {{package}}.tools

import com.embabel.agent.api.annotation.LlmTool
import org.springframework.stereotype.Component
import java.time.Clock
import java.time.LocalDate

/**
 * A tool object. Only methods annotated with @LlmTool are visible to an LLM,
 * and only for prompts where the object is added with withToolObject(...).
 */
@Component
class ClockTools(private val clock: Clock = Clock.systemUTC()) {

    @LlmTool(description = "Returns today's date in ISO-8601 format (yyyy-MM-dd)")
    fun today(): String = LocalDate.now(clock).toString()
}
