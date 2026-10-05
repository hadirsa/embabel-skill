import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeSources } from '../scripts/lib/plan-check.mjs';

const check = (text, ...more) => analyzeSources([{ file: 'A.java', text }, ...more.map((t, i) => ({ file: `B${i}.java`, text: t }))]);
const codes = (result) => result.findings.map((f) => f.code);

const HEAD = `
package demo;
import com.embabel.agent.api.annotation.*;
import com.embabel.agent.api.common.Ai;
import com.embabel.agent.domain.io.UserInput;
`;

test('a connected UserInput -> A -> B(goal) flow has no errors', () => {
  const r = check(`${HEAD}
    record A(String x) {}
    record B(String y) {}
    @Agent(description = "ok")
    class Good {
      @Action A first(UserInput in, Ai ai) { return null; }
      @AchievesGoal(description = "done") @Action B second(A a, Ai ai) { return null; }
    }`);
  assert.deepEqual(codes(r), []);
});

test('missing @AchievesGoal is an error', () => {
  const r = check(`${HEAD}
    record A(String x) {}
    @Agent(description = "no goal")
    class NoGoal { @Action A first(UserInput in) { return null; } }`);
  assert.deepEqual(codes(r), ['NO_GOAL']);
  assert.equal(r.findings[0].severity, 'error');
});

test('an explicit planner downgrades missing goal to a warning', () => {
  const r = check(`${HEAD}
    record A(String x) {}
    @Agent(description = "utility", planner = PlannerType.UTILITY)
    class Util { @Action A first(UserInput in) { return null; } }`);
  assert.equal(r.findings.find((f) => f.code === 'NO_GOAL').severity, 'warning');
});

test('a dependency cycle makes the goal unreachable', () => {
  const r = check(`${HEAD}
    record A(String x) {}
    record B(String y) {}
    record C(String z) {}
    @Agent(description = "cycle")
    class Cycle {
      @Action A makeA(B b) { return null; }
      @Action B makeB(A a) { return null; }
      @AchievesGoal(description = "g") @Action C makeC(A a, B b) { return null; }
    }`);
  assert.ok(codes(r).includes('UNREACHABLE_GOAL'));
  assert.ok(codes(r).includes('UNREACHABLE_ACTION'));
});

test('types nobody produces are reported as caller-supplied, not as errors', () => {
  const r = check(`${HEAD}
    record Request(String x) {}
    record Result(String y) {}
    @Agent(description = "supplied")
    class Supplied { @AchievesGoal(description = "g") @Action Result run(Request r) { return null; } }`);
  assert.deepEqual(codes(r), ['CALLER_SUPPLIED_INPUT']);
  assert.equal(r.findings[0].severity, 'info');
});

test('an entry action without parameters is information, not an error', () => {
  const r = check(`${HEAD}
    record Form(String x) {}
    record Result(String y) {}
    @Agent(description = "entry")
    class Entry {
      @Action Form ask() { return null; }
      @AchievesGoal(description = "g") @Action Result run(Form f) { return null; }
    }`);
  assert.deepEqual(codes(r), ['ACTION_NO_INPUTS']);
});

test('producers of the same type: overlapping inputs warn, unrelated inputs are alternatives, T -> T refinements are ignored', () => {
  const overlapping = check(`${HEAD}
    record P(String n) {}
    record R(String r) {}
    @Agent(description = "dup")
    class Dup {
      @Action P cheap(UserInput in) { return null; }
      @Action P careful(UserInput in, Ai ai) { return null; }
      @AchievesGoal(description = "g") @Action R done(P p) { return null; }
    }`);
  assert.ok(codes(overlapping).includes('DUPLICATE_PRODUCER'));

  const alternatives = check(`${HEAD}
    record P(String n) {}
    record R(String r) {}
    @Agent(description = "alt")
    class Alt {
      @Action P fromText(UserInput in) { return null; }
      @Action P fromForm(R r) { return null; }
      @AchievesGoal(description = "g") @Action R done(P p) { return null; }
    }`);
  assert.ok(codes(alternatives).includes('ALTERNATIVE_PRODUCERS'));
  assert.ok(!codes(alternatives).includes('DUPLICATE_PRODUCER'));

  const refine = check(`${HEAD}
    record Book(String t) {}
    @Agent(description = "refine")
    class Refine {
      @Action Book write(UserInput in) { return null; }
      @AchievesGoal(description = "g") @Action Book publish(Book b) { return b; }
    }`);
  assert.ok(!codes(refine).includes('DUPLICATE_PRODUCER'));
  assert.ok(!codes(refine).includes('ALTERNATIVE_PRODUCERS'));
});

test('raw String flow types are flagged as weak', () => {
  const r = check(`${HEAD}
    record R(String r) {}
    @Agent(description = "weak")
    class Weak {
      @Action String a(UserInput in) { return ""; }
      @AchievesGoal(description = "g") @Action R b(String s) { return null; }
    }`);
  assert.equal(codes(r).filter((c) => c === 'WEAK_FLOW_TYPE').length, 2);
});

test('nullable and infrastructure parameters are not flow inputs', () => {
  const r = check(`${HEAD}
    import org.springframework.lang.Nullable;
    record A(String x) {}
    record Extra(String e) {}
    @Agent(description = "opt")
    class Opt {
      @Action A first(UserInput in, @Nullable Extra extra, Ai ai, OperationContext ctx) { return null; }
      @AchievesGoal(description = "g") @Action Done last(A a) { return null; }
    }
    record Done(String d) {}`);
  assert.deepEqual(codes(r), []);
});

test('a non-static inner @State class is an error; a record state is fine', () => {
  const bad = check(`${HEAD}
    record Done(String d) {}
    @Agent(description = "states")
    class Outer {
      @Action Inner start(UserInput in) { return null; }
      @State class Inner {
        @AchievesGoal(description = "g") @Action Done finish() { return null; }
      }
    }`);
  assert.ok(codes(bad).includes('STATE_INNER_CLASS'));

  const good = check(`${HEAD}
    record Done(String d) {}
    @Agent(description = "states")
    class Outer {
      @Action Inner start(UserInput in) { return null; }
      @State record Inner(String data) {
        @AchievesGoal(description = "g") @Action Done finish() { return null; }
      }
    }`);
  assert.ok(!codes(good).includes('STATE_INNER_CLASS'));
  assert.ok(!codes(good).includes('NO_GOAL'));
  assert.ok(!codes(good).includes('UNREACHABLE_GOAL'));
});

test('goals inside state classes returned by actions count as the flow goal', () => {
  const r = check(`${HEAD}
    record Done(String d) {}
    @Agent(description = "states")
    class Machine {
      @Action Working start(UserInput in) { return new Working("x"); }
    }
    @State record Working(String data) {
      @AchievesGoal(description = "g") @Action Done finish() { return null; }
    }`);
  assert.ok(!codes(r).includes('NO_GOAL'));
  assert.ok(!codes(r).includes('UNREACHABLE_GOAL'));
});

test('SomeOf records produce each of their fields', () => {
  const r = check(`${HEAD}
    record Frog(String n) {}
    record Dog(String n) {}
    record Prince(String n) {}
    record FrogOrDog(@Nullable Frog frog, @Nullable Dog dog) implements SomeOf {}
    @Agent(description = "someof")
    class Route {
      @Action FrogOrDog pick(UserInput in) { return null; }
      @AchievesGoal(description = "g") @Action Prince toPrince(Frog frog) { return null; }
    }`);
  assert.deepEqual(codes(r), []);
});

test('subtype routing: an action returning a supertype can feed actions requiring subtypes', () => {
  const r = check(`${HEAD}
    interface Intent {}
    record Billing() implements Intent {}
    record Sales() implements Intent {}
    record Outcome(String o) {}
    @Agent(description = "routing")
    class Router {
      @Action Intent classify(UserInput in) { return null; }
      @AchievesGoal(description = "g") @Action Outcome billing(Billing b) { return null; }
      @Action Outcome sales(Sales s) { return null; }
    }`);
  assert.ok(!codes(r).includes('UNREACHABLE_GOAL'));
});

test('a custom pre-condition without any matching post is flagged; spel: is not', () => {
  const r = check(`${HEAD}
    record A(String x) {}
    record B(String y) {}
    @Agent(description = "conds")
    class Conds {
      @Action A first(UserInput in) { return null; }
      @AchievesGoal(description = "g") @Action(pre = {"isUrgent", "spel:a.x != null"}) B second(A a) { return null; }
    }`);
  const found = r.findings.filter((f) => f.code === 'CONDITION_NEVER_SET');
  assert.equal(found.length, 1);
  assert.match(found[0].message, /isUrgent/);

  const withPost = check(`${HEAD}
    record A(String x) {}
    record B(String y) {}
    @Agent(description = "conds")
    class Conds {
      @Action(post = {"isUrgent"}) A first(UserInput in) { return null; }
      @AchievesGoal(description = "g") @Action(pre = {"isUrgent"}) B second(A a) { return null; }
    }`);
  assert.ok(!codes(withPost).includes('CONDITION_NEVER_SET'));
});

test('record compact constructors, generics, text blocks and lambdas do not confuse the parser', () => {
  const r = check(`${HEAD}
    import java.util.*;
    record Cfg(Map<String, List<Integer>> m) {}
    record Out(String o) {}
    @Agent(description = "tricky")
    public record Tricky(Cfg config) {
      public Tricky {
        Objects.requireNonNull(config);
      }
      static final Map<String, Runnable> TABLE = Map.of("a", () -> { int x = 1; });
      @Action
      Out first(UserInput in, Ai ai) {
        var text = """
            @Action fake(String ignored) { not code }
            """;
        return ai.withDefaultLlm().createObject(text, Out.class);
      }
      @AchievesGoal(description = "g") @Action Final2 second(Out o) { return null; }
    }
    record Final2(String f) {}`);
  assert.deepEqual(codes(r), []);
  assert.deepEqual(r.agents, ['Tricky']);
});

test('a @State marker interface with implementing state records terminates and checks clean', () => {
  const r = check(`${HEAD}
    @Agent(description = "loop")
    public class Loop {
      public record Result(int rounds) {}
      @State public interface Outcome {}
      @Action public Counting begin(UserInput in) { return new Counting(0); }
      public record Counting(int round) implements Outcome {
        @Action(clearBlackboard = true) public Outcome tick() { return null; }
      }
      public record Finished(int rounds) implements Outcome {
        @AchievesGoal(description = "done") @Action public Result finish() { return new Result(rounds); }
      }
    }`);
  assert.deepEqual(codes(r), []); // nested state actions are counted once
});
