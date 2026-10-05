package {{package}}.domain

/**
 * What the user actually wants, extracted from free text.
 * Domain objects are typed inputs/outputs: their types are what the planner chains together.
 */
data class BriefingRequest(val topic: String, val audience: String)

/** Facts gathered for a briefing. */
data class Facts(val items: List<String>) {

    /** Behaviour belongs on domain objects, not only data. */
    fun asBulletList(): String = items.joinToString("\n") { "- $it" }
}

/** The final result: the type the agent's goal produces. */
data class Briefing(val markdown: String) {

    fun wordCount(): Int = if (markdown.isBlank()) 0 else markdown.trim().split(Regex("\\s+")).size
}
