package {{package}}.plan;

import com.embabel.agent.core.Agent;
import com.embabel.agent.core.AgentPlatform;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Checks agent plans on the model Embabel builds from your classes, so it works the same for
 * Java and Kotlin agents. Embabel's own startup validation accepts some flows that can never
 * finish; this finds them in a plain test, without running any LLM.
 *
 * <p>Model encoding (Embabel 1.5): type conditions are {@code it:<class name>}, run tracking is
 * {@code hasRun_<action>}, and custom conditions use the name given in {@code @Condition}.
 */
public final class AgentPlanCheck {

    public enum Severity { ERROR, WARNING, INFO }

    public record Finding(Severity severity, String code, String agent, String message) {
        @Override
        public String toString() {
            return severity + " " + code + " [" + agent + "] " + message;
        }
    }

    private static final String TYPE = "it:";
    private static final String HAS_RUN = "hasRun_";
    /** Provided by the platform for free-text requests, so never worth reporting as caller input. */
    private static final String USER_INPUT = "it:com.embabel.agent.domain.io.UserInput";
    private static final Set<String> WEAK_TYPES = Set.of(
            "java.lang.String", "java.lang.Integer", "java.lang.Long", "java.lang.Double", "java.lang.Boolean",
            "java.util.List", "java.util.Set", "java.util.Map", "java.util.Collection", "java.util.Optional",
            "kotlin.String", "kotlin.collections.List", "kotlin.collections.Map");

    private AgentPlanCheck() {
    }

    /** Checks the agents whose actions live in {@code basePackage} (framework agents are skipped). */
    public static List<Finding> check(AgentPlatform platform, String basePackage) {
        var agents = platform.agents().stream()
                .filter(agent -> agent.getActions().stream().anyMatch(a -> a.getName().startsWith(basePackage)))
                .toList();
        return check(agents);
    }

    public static List<Finding> check(Collection<? extends Agent> agents) {
        var findings = new ArrayList<Finding>();
        for (var agent : agents) {
            checkAgent(agent, findings);
        }
        findings.sort((a, b) -> a.severity().compareTo(b.severity()));
        return findings;
    }

    public static List<Finding> errors(List<Finding> findings) {
        return findings.stream().filter(f -> f.severity() == Severity.ERROR).toList();
    }

    public static String report(List<Finding> findings) {
        if (findings.isEmpty()) {
            return "Agent plan check: no findings.";
        }
        return findings.stream().map(Finding::toString).collect(Collectors.joining("\n", "Agent plan check:\n", ""));
    }

    private static void checkAgent(Agent agent, List<Finding> findings) {
        var name = agent.getName();
        if (agent.getActions().isEmpty()) {
            findings.add(new Finding(Severity.ERROR, "NO_ACTIONS", name, "The agent has no actions."));
            return;
        }
        if (agent.getGoals().isEmpty()) {
            findings.add(new Finding(Severity.ERROR, "NO_GOAL", name,
                    "No @AchievesGoal action. A GOAP agent cannot execute without a goal."));
        }

        // What each action needs (TRUE preconditions) and what it makes true (TRUE effects).
        var needs = new LinkedHashMap<String, Set<String>>();
        var makes = new LinkedHashMap<String, Set<String>>();
        var produces = new LinkedHashMap<String, String>(); // action -> its own output type key
        var binding = new LinkedHashMap<String, String>();  // action -> raw output binding, e.g. "gpt4Report:com.acme.Report"
        for (var action : agent.getActions()) {
            needs.put(action.getName(), trueKeys(action.getPreconditions()));
            makes.put(action.getName(), trueKeys(action.getEffects()));
            // The declared output type (outputs are bindings like "it:com.acme.Story" or "name:com.acme.Story").
            action.getOutputs().stream().findFirst().ifPresent(output -> {
                var key = typeKeyOf(output);
                if (key != null) {
                    produces.put(action.getName(), key);
                    binding.put(action.getName(), bindingOf(output));
                }
            });
        }
        var allEffects = makes.values().stream().flatMap(Set::stream).collect(Collectors.toSet());
        // Effects also list supertypes (Record, HasContent, ...). Only declared outputs say what an action produces.
        var outputs = new HashSet<>(produces.values());

        // 1. Custom conditions that no action declares as an effect (post) are never considered true.
        var conditionUsers = new LinkedHashMap<String, List<String>>();
        needs.forEach((action, keys) -> keys.stream().filter(AgentPlanCheck::isCustomCondition)
                .forEach(k -> conditionUsers.computeIfAbsent(k, x -> new ArrayList<>()).add(shortName(action))));
        for (var goal : agent.getGoals()) {
            trueKeys(goal.getPreconditions()).stream().filter(AgentPlanCheck::isCustomCondition)
                    .forEach(k -> conditionUsers.computeIfAbsent(k, x -> new ArrayList<>()).add("goal"));
        }
        conditionUsers.forEach((condition, users) -> {
            if (!allEffects.contains(condition)) {
                findings.add(new Finding(Severity.ERROR, "CONDITION_NEVER_SET", name,
                        "Condition '" + condition + "' is required by " + String.join(", ", new LinkedHashSet<>(users))
                                + " but no action declares it in post = {...}, so the planner never counts on it."));
            }
        });

        // 2. Reachability. Types that no action produces are assumed to come from the caller.
        var available = new HashSet<String>();
        var supplied = new LinkedHashSet<String>();
        for (var keys : needs.values()) {
            for (var key : keys) {
                if (key.startsWith(TYPE) && outputs.stream().noneMatch(o -> related(o, key))) {
                    supplied.add(key);
                }
            }
        }
        available.addAll(supplied);
        var ran = new LinkedHashSet<String>();
        boolean progress = true;
        while (progress) {
            progress = false;
            for (var action : needs.keySet()) {
                if (ran.contains(action)) {
                    continue;
                }
                if (needs.get(action).stream().allMatch(key -> satisfied(key, available, outputs))) {
                    ran.add(action);
                    available.addAll(makes.get(action));
                    progress = true;
                }
            }
        }
        for (var goal : agent.getGoals()) {
            // Ignore what the goal action itself makes (its run marker and its output): report the real blockers.
            var ownEffects = makes.getOrDefault(goal.getName(), Set.of());
            var missing = trueKeys(goal.getPreconditions()).stream()
                    .filter(key -> !satisfied(key, available, outputs) && !ownEffects.contains(key)).toList();
            if (!missing.isEmpty()) {
                findings.add(new Finding(Severity.ERROR, "UNREACHABLE_GOAL", name,
                        "Goal " + shortName(goal.getName()) + " can never be reached; missing " + describe(missing)
                                + ". Look for a dependency cycle, a broken type chain, or a condition never set."));
            }
        }
        for (var action : needs.keySet()) {
            if (!ran.contains(action)) {
                var missing = needs.get(action).stream()
                        .filter(key -> !satisfied(key, available, outputs) && !makes.get(action).contains(key)).toList();
                findings.add(new Finding(Severity.WARNING, "UNREACHABLE_ACTION", name,
                        "Action " + shortName(action) + " can never run; missing " + describe(missing) + "."));
            }
        }
        supplied.remove(USER_INPUT);
        if (!supplied.isEmpty()) {
            findings.add(new Finding(Severity.INFO, "CALLER_SUPPLIED_INPUT", name,
                    "Inputs the caller must provide (nothing produces them): " + describe(supplied)
                            + ". If one of these was meant to come from another action, the type chain is broken."));
        }

        // 3. Competing producers: same output type from overlapping inputs.
        var byOutput = new LinkedHashMap<String, List<String>>();
        produces.forEach((action, type) -> {
            var guarded = needs.get(action).stream().anyMatch(AgentPlanCheck::isCustomCondition);
            if (!needs.get(action).contains(type) && !guarded) { // T -> T refinements and condition-guarded routes are fine
                byOutput.computeIfAbsent(binding.get(action), x -> new ArrayList<>()).add(action); // same named binding
            }
        });
        byOutput.forEach((type, actions) -> {
            for (int i = 0; i < actions.size(); i++) {
                for (int j = i + 1; j < actions.size(); j++) {
                    var a = typeNeeds(needs.get(actions.get(i)));
                    var b = typeNeeds(needs.get(actions.get(j)));
                    if (a.containsAll(b) || b.containsAll(a)) {
                        findings.add(new Finding(Severity.WARNING, "DUPLICATE_PRODUCER", name,
                                shortName(actions.get(i)) + " and " + shortName(actions.get(j)) + " both produce "
                                        + simple(typeKeyOf(type)) + " from overlapping inputs; the planner may pick either."));
                    }
                }
            }
        });

        // 4. Weak flow types: a String on the blackboard matches every action that wants a String.
        var weak = new LinkedHashSet<String>();
        produces.values().stream().filter(t -> WEAK_TYPES.contains(t.substring(TYPE.length()))).forEach(weak::add);
        needs.values().stream().flatMap(Set::stream)
                .filter(k -> k.startsWith(TYPE) && WEAK_TYPES.contains(k.substring(TYPE.length()))).forEach(weak::add);
        if (!weak.isEmpty()) {
            findings.add(new Finding(Severity.WARNING, "WEAK_FLOW_TYPE", name,
                    "Generic types used as flow types: " + describe(weak) + ". Wrap each value in a dedicated record."));
        }
    }

    /** Custom conditions are plain names; data bindings contain ':' ("it:Type", "name:Type", "spel:..."). */
    private static boolean isCustomCondition(String key) {
        return !key.contains(":") && !key.startsWith(HAS_RUN);
    }

    private static String bindingOf(Object ioBinding) {
        var text = String.valueOf(ioBinding);
        var start = text.indexOf("value=");
        return start >= 0 ? text.substring(start + "value=".length(), text.lastIndexOf(')')) : text;
    }

    /** Turns an IoBinding (printed as "IoBinding(value=name:com.acme.Type)") into "it:com.acme.Type". */
    private static String typeKeyOf(Object binding) {
        var text = String.valueOf(binding);
        var start = text.indexOf("value=");
        var value = start >= 0 ? text.substring(start + "value=".length(), text.lastIndexOf(')')) : text;
        var colon = value.lastIndexOf(':');
        return colon >= 0 ? TYPE + value.substring(colon + 1) : null;
    }

    private static boolean satisfied(String key, Set<String> available, Set<String> outputs) {
        if (available.contains(key)) {
            return true;
        }
        if (!key.startsWith(TYPE)) {
            return false;
        }
        // A subtype on the blackboard satisfies a supertype need; and subtype routing: an action whose
        // declared output is a supertype may produce the subtype an action needs.
        return available.stream().anyMatch(a -> a.startsWith(TYPE)
                && (isSubtype(a, key) || (outputs.contains(a) && isSubtype(key, a))));
    }

    /** True if the type in {@code subKey} can be assigned to the type in {@code superKey}. */
    private static boolean isSubtype(String subKey, String superKey) {
        var sub = load(subKey.substring(TYPE.length()));
        var sup = load(superKey.substring(TYPE.length()));
        return sub != null && sup != null && sup != Object.class && sup != Record.class && sup.isAssignableFrom(sub);
    }

    private static boolean related(String typeKeyA, String typeKeyB) {
        if (typeKeyA.equals(typeKeyB)) {
            return true;
        }
        var a = load(typeKeyA.substring(TYPE.length()));
        var b = load(typeKeyB.substring(TYPE.length()));
        if (a == null || b == null || a == Object.class || b == Object.class || a == Record.class || b == Record.class) {
            return false;
        }
        return a.isAssignableFrom(b) || b.isAssignableFrom(a);
    }

    private static Class<?> load(String className) {
        try {
            return Class.forName(className, false, Thread.currentThread().getContextClassLoader());
        } catch (ClassNotFoundException | LinkageError e) {
            return null;
        }
    }

    private static Set<String> trueKeys(Map<String, ?> spec) {
        return spec.entrySet().stream().filter(e -> "TRUE".equals(String.valueOf(e.getValue())))
                .map(Map.Entry::getKey).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<String> falseKeys(Map<String, ?> spec) {
        return spec.entrySet().stream().filter(e -> "FALSE".equals(String.valueOf(e.getValue())))
                .map(Map.Entry::getKey).collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<String> typeNeeds(Set<String> keys) {
        return keys.stream().filter(k -> k.startsWith(TYPE)).collect(Collectors.toSet());
    }

    private static String describe(Collection<String> keys) {
        return keys.stream().map(AgentPlanCheck::simple).collect(Collectors.joining(", "));
    }

    private static String simple(String key) {
        if (key.startsWith(TYPE)) {
            var className = key.substring(TYPE.length());
            return className.substring(Math.max(className.lastIndexOf('.'), className.lastIndexOf('$')) + 1);
        }
        return key.startsWith(HAS_RUN) ? "run of " + shortName(key.substring(HAS_RUN.length())) : "'" + key + "'";
    }

    private static String shortName(String actionName) {
        var parts = actionName.split("\\.");
        return parts.length >= 2 ? parts[parts.length - 2] + "." + parts[parts.length - 1] : actionName;
    }
}
