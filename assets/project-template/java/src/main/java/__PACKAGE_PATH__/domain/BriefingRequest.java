package {{package}}.domain;

/**
 * What the user actually wants, extracted from free text.
 * Domain objects are typed inputs/outputs: their types are what the planner chains together.
 */
public record BriefingRequest(String topic, String audience) {
}
