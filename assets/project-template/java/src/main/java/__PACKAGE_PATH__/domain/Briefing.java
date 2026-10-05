package {{package}}.domain;

/** The final result: the type the agent's goal produces. */
public record Briefing(String markdown) {

    public int wordCount() {
        return markdown.isBlank() ? 0 : markdown.trim().split("\\s+").length;
    }
}
