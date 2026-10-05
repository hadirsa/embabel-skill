// Static checks for Embabel agent flows. Embabel plans from method signatures, so mistakes in
// types (a missing goal, an input nobody produces, a cycle) compile fine and then stall at runtime.
// This module finds them without running anything. It is a heuristic over Java sources:
// it reports what it can prove and downgrades what it cannot to warnings.
import { parseJava } from './java-parser.mjs';

/** Parameters of these types are infrastructure injected by the framework, not blackboard inputs. */
const INFRA_TYPES = new Set([
  'Ai', 'AiBuilder', 'OperationContext', 'ActionContext', 'ExecutingOperationContext',
  'TransformationActionContext', 'SupplierActionContext', 'ProcessContext', 'Blackboard',
  'AgentProcess', 'ToolCallContext', 'PromptRunner', 'AgentPlatform',
]);

/** Used as flow types these are ambiguous: any String on the blackboard would match. */
const WEAK_FLOW_TYPES = new Set([
  'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean', 'Short', 'Byte', 'Character',
  'int', 'long', 'double', 'float', 'boolean', 'short', 'byte', 'char',
  'List', 'Set', 'Map', 'Collection', 'Optional',
]);

/** Types the platform provides when an agent is invoked with free text. */
const BUILT_IN_INPUTS = new Set(['UserInput']);

const has = (annotations, name) => annotations.some((a) => a.name === name);
const find = (annotations, name) => annotations.find((a) => a.name === name);

export function isInfraParam(param) {
  if (has(param.annotations, 'Provided')) return true;
  return INFRA_TYPES.has(param.type) || /Context$/.test(param.type);
}

export function analyzeSources(sources) {
  const types = sources.flatMap(({ file, text }) => parseJava(text, file));
  const byName = new Map();
  for (const decl of types) if (!byName.has(decl.name)) byName.set(decl.name, decl);

  const parents = (name, seen = new Set()) => {
    if (seen.has(name)) return seen;
    seen.add(name);
    const decl = byName.get(name);
    if (decl) [...decl.extends, ...decl.implements].forEach((p) => parents(p, seen));
    return seen;
  };
  const assignable = (from, to) => from === to || parents(from).has(to);

  const findings = [];
  const add = (severity, code, decl, line, message, hint) =>
    findings.push({ severity, code, agent: decl?.name ?? null, file: decl?.file ?? null, line: line ?? null, message, hint });

  const agents = types.filter((t) => has(t.annotations, 'Agent') || has(t.annotations, 'EmbabelComponent'));
  const stateTypes = types.filter((t) => has(t.annotations, 'State') || [...parents(t.name)].some((p) => has(byName.get(p)?.annotations ?? [], 'State')));

  // @State classes must not be non-static inner classes (the framework throws IllegalStateException).
  for (const decl of stateTypes) {
    if (decl.parent && decl.kind === 'class' && !decl.modifiers.has('static') && decl.parent.kind !== 'interface') {
      add('error', 'STATE_INNER_CLASS', decl, decl.line,
        `@State class ${decl.name} is a non-static inner class of ${decl.parent.name}.`,
        'Make it a record or a static nested class: inner classes keep a reference to the outer instance, which breaks persistence.');
    }
  }

  const methodsOf = (decl) => [decl, ...allNested(decl)].flatMap((d) => d.methods.map((m) => ({ ...m, owner: d })));
  const actionsOf = (decl) => methodsOf(decl).filter((m) => has(m.annotations, 'Action'));

  for (const agent of agents) {
    const isAgent = has(agent.annotations, 'Agent');
    let unit = actionsOf(agent);

    // Pull in actions from @State classes whose type this flow produces (they are part of the plan).
    const producedNames = () => new Set(unit.flatMap((a) => producedTypes(a, byName)));
    const included = new Set(); // states already merged (a state without actions must still be marked, or this never ends)
    let grew = true;
    while (grew) {
      grew = false;
      for (const state of stateTypes) {
        if (included.has(state)) continue;
        if ([...producedNames()].some((p) => assignable(p, state.name))) {
          included.add(state);
          // Nested states are already part of the agent's own actions: add only what is new.
          const isKnown = (a) => unit.some((u) => u.owner === a.owner && u.name === a.name && u.line === a.line);
          unit = [...unit, ...actionsOf(state).filter((a) => !isKnown(a))];
          grew = true;
        }
      }
    }
    // State actions need their own state object as an input.
    const needsOf = (action) => {
      const needs = action.params
        .filter((p) => !isInfraParam(p) && !has(p.annotations, 'Nullable'))
        .map((p) => p.type);
      if (stateTypes.includes(action.owner)) needs.push(action.owner.name);
      return needs;
    };

    if (unit.length === 0) {
      add('warning', 'NO_ACTIONS', agent, agent.line, `${agent.name} declares no @Action methods.`,
        'An agent without actions can never plan anything.');
      continue;
    }

    for (const action of unit) {
      if (action.params.length === 0 && !stateTypes.includes(action.owner)) {
        // The reference docs say actions need a parameter, but official examples declare entry actions
        // without one (a WaitFor form that starts the flow), so this is information, not an error.
        add('info', 'ACTION_NO_INPUTS', action.owner, action.line,
          `Action ${action.owner.name}.${action.name}() takes no parameters, so it can run immediately at the start of the plan.`,
          'Fine for an entry action such as a WaitFor form. If it was meant to depend on earlier results, add the input types as parameters.');
      }
      for (const p of action.params) {
        if (!isInfraParam(p) && WEAK_FLOW_TYPES.has(p.type)) {
          add('warning', 'WEAK_FLOW_TYPE', action.owner, action.line,
            `Action ${action.name}() takes a ${p.rawType} parameter "${p.name}" as a flow type.`,
            'Wrap values in a dedicated record: planning matches by type, so every String on the blackboard would match.');
        }
      }
      if (action.returnType && action.returnType !== 'void' && WEAK_FLOW_TYPES.has(action.returnType)) {
        add('warning', 'WEAK_FLOW_TYPE', action.owner, action.line,
          `Action ${action.name}() returns ${action.rawReturnType}, a generic type that other actions cannot depend on precisely.`,
          'Return a dedicated record so downstream actions can require exactly this result.');
      }
    }

    const goals = unit.filter((a) => has(a.annotations, 'AchievesGoal'));
    // Only the UTILITY planner works without goals (PlannerType.needsGoals = false); GOAP, HYBRID and SUPERVISOR need one.
    const goalless = /UTILITY/.test(find(agent.annotations, 'Agent')?.attrs?.planner?.raw ?? '');
    if (isAgent && goals.length === 0) {
      add(goalless ? 'warning' : 'error', 'NO_GOAL', agent, agent.line,
        `${agent.name} has no @AchievesGoal action.`,
        'Annotate the terminal action with @AchievesGoal(description = ...). Without a goal the agent cannot execute.');
    }

    // Duplicate producers: two actions returning the same type make the plan ambiguous.
    const producers = new Map();
    for (const action of unit) {
      for (const type of producedTypes(action, byName)) {
        if (!producers.has(type)) producers.set(type, []);
        producers.get(type).push(action);
      }
    }
    const subset = (a, b) => a.every((x) => b.includes(x));
    for (const [type, allProducers] of producers) {
      // An action that also consumes the type is a refinement step (Book -> Book), not a competing producer.
      const actions = allProducers.filter((a) => !needsOf(a).includes(type));
      if (type === 'void' || actions.length < 2) continue;
      // Producers with unrelated inputs are alternative routes (e.g. one handler per subtype) and rarely
      // compete. If one needs only what another needs, both can run from the same state: that is ambiguous.
      const overlapping = actions.some((a, i) => actions.slice(i + 1).some((b) =>
        subset(needsOf(a), needsOf(b)) || subset(needsOf(b), needsOf(a))));
      const names = actions.map((a) => a.name + '()').join(' and ');
      if (overlapping) {
        add('warning', 'DUPLICATE_PRODUCER', agent, actions[1].line,
          `${names} both produce ${type} from overlapping inputs.`,
          'The planner may choose either. If that is intended (retries, alternatives), guard them with conditions; otherwise use distinct types.');
      } else {
        add('info', 'ALTERNATIVE_PRODUCERS', agent, actions[1].line,
          `${names} are alternative routes to ${type} (different inputs).`,
          'Fine for routing. Make sure the inputs cannot all be present at once unless you want the planner to choose by cost.');
      }
    }

    // Reachability by forward chaining. Types nobody produces are assumed to come from the caller.
    const produced = new Set([...producers.keys()]);
    const needed = new Set(unit.flatMap(needsOf));
    const supplied = new Set(
      [...needed].filter((t) => !BUILT_IN_INPUTS.has(t) && ![...produced].some((p) => assignable(p, t) || assignable(t, p))),
    );
    const available = new Set([...BUILT_IN_INPUTS, ...supplied]);
    const satisfied = (need) => [...available].some((a) => assignable(a, need) || assignable(need, a));
    const ran = new Set();
    let progress = true;
    while (progress) {
      progress = false;
      for (const action of unit) {
        if (ran.has(action)) continue;
        if (needsOf(action).every(satisfied)) {
          ran.add(action);
          producedTypes(action, byName).forEach((t) => available.add(t));
          progress = true;
        }
      }
    }

    if (supplied.size > 0) {
      add('info', 'CALLER_SUPPLIED_INPUT', agent, agent.line,
        `${agent.name} expects the caller to provide: ${[...supplied].join(', ')}.`,
        'Pass these when invoking (AgentInvocation.invoke(...)). UserInput is provided automatically for free-text requests.');
    }

    for (const goal of goals) {
      if (ran.has(goal)) continue;
      const missing = needsOf(goal).filter((n) => !satisfied(n));
      add('error', 'UNREACHABLE_GOAL', goal.owner, goal.line,
        `Goal action ${goal.name}() can never run: ${missing.join(', ')} is produced only by actions that cannot run themselves (a dependency cycle or missing link).`,
        'Trace the chain backwards from the goal and make sure every input type is produced by an action whose inputs are available.');
    }
    for (const action of unit) {
      if (ran.has(action) || goals.includes(action)) continue;
      const missing = needsOf(action).filter((n) => !satisfied(n));
      add('warning', 'UNREACHABLE_ACTION', action.owner, action.line,
        `Action ${action.name}() can never run: waiting for ${missing.join(', ')}.`,
        'Check for a dependency cycle or an input type that no action returns.');
    }

    // Custom conditions: pre-conditions need a matching post-condition somewhere.
    const posts = new Set(unit.flatMap((a) => find(a.annotations, 'Action')?.attrs?.post?.strings ?? []));
    for (const action of unit) {
      for (const pre of find(action.annotations, 'Action')?.attrs?.pre?.strings ?? []) {
        if (pre.startsWith('spel:') || posts.has(pre)) continue;
        add('warning', 'CONDITION_NEVER_SET', action.owner, action.line,
          `Action ${action.name}() has pre-condition "${pre}", but no action lists it in post = {...}.`,
          'Declare the condition in post on every action that may make it true; otherwise the planner assumes it is never set.');
      }
    }
  }

  const order = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || String(a.file).localeCompare(String(b.file)) || (a.line ?? 0) - (b.line ?? 0));
  return { agents: agents.map((a) => a.name), findings };
}

function allNested(decl) {
  return decl.nested.flatMap((n) => [n, ...allNested(n)]);
}

/** Types an action makes available: its return type, or the fields of a SomeOf record. */
function producedTypes(action, byName) {
  const type = action.returnType;
  if (!type || type === 'void') return [];
  const decl = byName.get(type);
  if (decl?.kind === 'record' && decl.implements.includes('SomeOf')) {
    return decl.components.map((c) => c.type);
  }
  return [type];
}
