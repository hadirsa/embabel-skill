package {{package}}.domain;

import java.util.List;

/** Facts gathered for a briefing. */
public record Facts(List<String> items) {

    /** Behaviour belongs on domain objects, not only data. */
    public String asBulletList() {
        return items.stream().map(item -> "- " + item).reduce((a, b) -> a + "\n" + b).orElse("");
    }
}
