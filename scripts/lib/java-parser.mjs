// A small, dependency-free Java parser. It understands just enough of the language to extract
// types, their annotations, supertypes, record components and method signatures. Method and
// initializer bodies are skipped, so it stays tolerant of any Java syntax inside them.
// It is NOT a compiler: it exists so check-plan.mjs can reason about Embabel flows without a build.

const MODIFIERS = new Set([
  'public', 'protected', 'private', 'static', 'final', 'abstract', 'sealed', 'default',
  'synchronized', 'native', 'transient', 'volatile', 'strictfp',
]);

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const n = source.length;
  const push = (t, v, startLine) => tokens.push({ t, v, line: startLine });

  while (i < n) {
    const c = source[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }

    if (c === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"') {
      const startLine = line;
      if (source.startsWith('"""', i)) {
        i += 3;
        let value = '';
        while (i < n && !source.startsWith('"""', i)) {
          if (source[i] === '\\') { value += source[i + 1] ?? ''; i += 2; continue; }
          if (source[i] === '\n') line++;
          value += source[i++];
        }
        i += 3;
        push('str', value, startLine);
      } else {
        i++;
        let value = '';
        while (i < n && source[i] !== '"') {
          if (source[i] === '\\') { value += source[i + 1] ?? ''; i += 2; continue; }
          if (source[i] === '\n') line++;
          value += source[i++];
        }
        i++;
        push('str', value, startLine);
      }
      continue;
    }
    if (c === "'") {
      const startLine = line;
      i++;
      while (i < n && source[i] !== "'") {
        if (source[i] === '\\') i++;
        i++;
      }
      i++;
      push('chr', '', startLine);
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const start = i;
      while (i < n && /[\w$]/.test(source[i])) i++;
      push('id', source.slice(start, i), line);
      continue;
    }
    if (/[0-9]/.test(c)) {
      const start = i;
      while (i < n && /[\w.]/.test(source[i])) i++;
      push('num', source.slice(start, i), line);
      continue;
    }
    push('p', c, line);
    i++;
  }
  return tokens;
}

class Parser {
  constructor(tokens, file) {
    this.tokens = tokens;
    this.i = 0;
    this.file = file;
    this.types = [];
  }

  get tok() { return this.tokens[this.i]; }
  peek(offset = 1) { return this.tokens[this.i + offset]; }
  isP(v, tok = this.tok) { return tok?.t === 'p' && tok.v === v; }
  isId(v, tok = this.tok) { return tok?.t === 'id' && (v === undefined || tok.v === v); }

  skipBalanced(open, close) {
    let depth = 0;
    while (this.tok) {
      if (this.isP(open)) depth++;
      else if (this.isP(close)) {
        depth--;
        if (depth === 0) { this.i++; return; }
      }
      this.i++;
    }
  }

  /** Skip generic arguments or type parameters starting at '<'. */
  skipAngles() {
    let depth = 0;
    while (this.tok) {
      if (this.isP('<')) depth++;
      else if (this.isP('>')) {
        depth--;
        if (depth === 0) { this.i++; return; }
      } else if (this.isP('{') || this.isP(';')) return; // not generics after all; bail out
      this.i++;
    }
  }

  parseAnnotations() {
    const annotations = [];
    while (this.isP('@') && !this.isId('interface', this.peek())) {
      const line = this.tok.line;
      this.i++;
      let name = '';
      while (this.isId()) {
        name = this.tok.v;
        this.i++;
        if (this.isP('.') && this.isId(undefined, this.peek())) this.i++;
        else break;
      }
      let attrs = {};
      if (this.isP('(')) {
        const start = this.i;
        this.skipBalanced('(', ')');
        attrs = parseAnnotationArgs(this.tokens.slice(start + 1, this.i - 1));
      }
      annotations.push({ name, attrs, line });
    }
    return annotations;
  }

  parseModifiers() {
    const mods = new Set();
    for (;;) {
      if (this.isId() && MODIFIERS.has(this.tok.v) && !(this.tok.v === 'default' && this.isP(':', this.peek()))) {
        mods.add(this.tok.v);
        this.i++;
      } else if (this.isId('non') && this.isP('-', this.peek()) && this.isId('sealed', this.peek(2))) {
        this.i += 3;
      } else break;
    }
    return mods;
  }

  /** Reads a type such as `List<Foo>`, `com.x.Foo[]` and returns its simple base name. */
  readType() {
    this.parseAnnotations();
    let name = '';
    let raw = '';
    while (this.isId()) {
      name = this.tok.v;
      raw += this.tok.v;
      this.i++;
      if (this.isP('<')) { this.skipAngles(); raw += '<>'; }
      if (this.isP('.') && this.isId(undefined, this.peek())) { raw += '.'; this.i++; continue; }
      break;
    }
    while (this.isP('[') && this.isP(']', this.peek())) { this.i += 2; raw += '[]'; }
    return { name, raw };
  }

  parseParams() {
    const params = [];
    this.i++; // '('
    while (this.tok && !this.isP(')')) {
      const annotations = this.parseAnnotations();
      this.parseModifiers();
      const type = this.readType();
      if (this.isP('.') && this.isP('.', this.peek())) this.i += 3; // varargs
      const nameTok = this.tok;
      if (this.isId()) this.i++;
      while (this.isP('[') && this.isP(']', this.peek())) this.i += 2;
      params.push({ type: type.name, rawType: type.raw, name: nameTok?.v ?? '', annotations });
      if (this.isP(',')) this.i++;
      else if (!this.isP(')')) this.i++; // recover from anything unexpected
    }
    this.i++; // ')'
    return params;
  }

  isTypeKeyword() {
    if (this.isId('class') || this.isId('interface') || this.isId('enum')) return true;
    if (this.isP('@') && this.isId('interface', this.peek())) return true;
    // `record` is a contextual keyword: only a declaration when followed by `Name (` or `Name <`
    return this.isId('record') && this.isId(undefined, this.peek()) &&
      (this.isP('(', this.peek(2)) || this.isP('<', this.peek(2)));
  }

  parseTypeDecl(annotations, mods, parent) {
    const line = this.tok.line;
    let kind = this.tok.v;
    if (this.isP('@')) { this.i++; kind = '@interface'; }
    this.i++;
    const name = this.tok?.v ?? '';
    this.i++;
    if (this.isP('<')) this.skipAngles();

    const decl = {
      kind, name, annotations, modifiers: mods, parent, line, file: this.file,
      extends: [], implements: [], components: [], methods: [], nested: [],
    };
    if (kind === 'record' && this.isP('(')) decl.components = this.parseParams();

    // extends / implements / permits clauses
    let clause = null;
    while (this.tok && !this.isP('{')) {
      if (this.isId('extends') || this.isId('implements') || this.isId('permits')) {
        clause = this.tok.v;
        this.i++;
        continue;
      }
      if (this.isId()) {
        const type = this.readType();
        if (type.name) {
          if (clause === 'extends' && kind === 'class') decl.extends.push(type.name);
          else if (clause === 'extends' || clause === 'implements') decl.implements.push(type.name);
        }
        continue;
      }
      this.i++;
    }
    this.types.push(decl);
    if (parent) parent.nested.push(decl);

    if (kind === '@interface' || kind === 'enum') {
      if (this.isP('{')) this.skipBalanced('{', '}');
      return decl;
    }
    if (this.isP('{')) {
      this.i++;
      this.parseBody(decl);
    }
    return decl;
  }

  parseBody(decl) {
    while (this.tok && !this.isP('}')) {
      if (this.isP(';')) { this.i++; continue; }
      const annotations = this.parseAnnotations();
      const mods = this.parseModifiers();
      const more = this.parseAnnotations();
      annotations.push(...more);

      if (this.isTypeKeyword()) {
        this.parseTypeDecl(annotations, mods, decl);
        continue;
      }
      if (this.isP('{')) { this.skipBalanced('{', '}'); continue; } // initializer
      if (this.isP('<')) this.skipAngles(); // generic method type parameters

      // compact canonical constructor of a record: Name { ... }
      if (this.isId(decl.name) && this.isP('{', this.peek())) {
        this.i++;
        this.skipBalanced('{', '}');
        continue;
      }
      // constructor: Name(
      if (this.isId() && this.isP('(', this.peek())) {
        this.i++;
        this.parseParams();
        this.skipMemberTail();
        continue;
      }
      const returnType = this.readType();
      const nameTok = this.tok;
      if (!this.isId()) { this.i++; continue; } // recover
      this.i++;
      if (this.isP('(')) {
        const params = this.parseParams();
        while (this.isP('[') && this.isP(']', this.peek())) this.i += 2;
        decl.methods.push({
          name: nameTok.v, returnType: returnType.name, rawReturnType: returnType.raw,
          params, annotations, modifiers: mods, line: nameTok.line,
        });
        this.skipMemberTail();
      } else {
        this.skipField();
      }
    }
    this.i++; // '}'
  }

  /** After a parameter list: skip `throws ...`, then a body `{...}` or a terminating `;`. */
  skipMemberTail() {
    while (this.tok && !this.isP('{') && !this.isP(';')) this.i++;
    if (this.isP('{')) this.skipBalanced('{', '}');
    else if (this.isP(';')) this.i++;
  }

  skipField() {
    let depth = 0;
    while (this.tok) {
      if (this.isP('(') || this.isP('{') || this.isP('[')) depth++;
      else if (this.isP(')') || this.isP('}') || this.isP(']')) depth--;
      else if (this.isP(';') && depth <= 0) { this.i++; return; }
      this.i++;
    }
  }

  parseCompilationUnit() {
    while (this.tok) {
      if (this.isId('package') || this.isId('import')) {
        while (this.tok && !this.isP(';')) this.i++;
        this.i++;
        continue;
      }
      if (this.isP(';')) { this.i++; continue; }
      const annotations = this.parseAnnotations();
      const mods = this.parseModifiers();
      if (this.isTypeKeyword()) this.parseTypeDecl(annotations, mods, null);
      else this.i++;
    }
    return this.types;
  }
}

/** `@Action(pre = {"a", "b"}, canRerun = true)` -> { pre: {strings:['a','b'], raw:'...'}, canRerun: {...} } */
function parseAnnotationArgs(tokens) {
  const attrs = {};
  const groups = [];
  let current = [];
  let depth = 0;
  for (const token of tokens) {
    if (token.t === 'p' && '({['.includes(token.v)) depth++;
    if (token.t === 'p' && ')}]'.includes(token.v)) depth--;
    if (token.t === 'p' && token.v === ',' && depth === 0) { groups.push(current); current = []; continue; }
    current.push(token);
  }
  if (current.length) groups.push(current);

  for (const group of groups) {
    let key = 'value';
    let valueTokens = group;
    if (group[0]?.t === 'id' && group[1]?.t === 'p' && group[1].v === '=') {
      key = group[0].v;
      valueTokens = group.slice(2);
    }
    attrs[key] = {
      strings: valueTokens.filter((t) => t.t === 'str').map((t) => t.v),
      raw: valueTokens.map((t) => t.v).join(' '),
    };
  }
  return attrs;
}

export function parseJava(source, file = '<memory>') {
  return new Parser(tokenize(source), file).parseCompilationUnit();
}
