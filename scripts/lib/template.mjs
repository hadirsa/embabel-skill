// Tiny, dependency-free project templating: token replacement in file paths and contents.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
  'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
  'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
  'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null', 'var', 'record',
]);

export function validateProjectName(name) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name ?? '')) {
    throw new Error(`Invalid project name "${name}". Use lowercase letters, digits and single hyphens, e.g. trip-planner.`);
  }
}

export function validatePackage(pkg) {
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/.test(pkg ?? '')) {
    throw new Error(`Invalid Java package "${pkg}". Use lowercase dotted segments, e.g. com.acme.trip.`);
  }
  const bad = pkg.split('.').find((segment) => JAVA_KEYWORDS.has(segment));
  if (bad) throw new Error(`Invalid Java package "${pkg}": "${bad}" is a reserved Java word.`);
}

export function validateAgentName(name) {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name ?? '')) {
    throw new Error(`Invalid agent name "${name}". Use PascalCase without spaces, e.g. TripPlanner.`);
  }
}

export function pascalCase(kebab) {
  return kebab
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

export function lowerCamel(pascal) {
  return pascal[0].toLowerCase() + pascal.slice(1);
}

/** Replace every {{token}} and __PATH_TOKEN__ present in `vars`; leave unknown tokens untouched. */
export function render(text, vars) {
  return text.replace(/\{\{(\w+)\}\}|__(\w+)__/g, (match, braceKey, underscoreKey) => {
    const key = braceKey ?? underscoreKey;
    return Object.hasOwn(vars, key) ? vars[key] : match;
  });
}

export function findUnresolvedTokens(text) {
  return [...text.matchAll(/\{\{\w+\}\}/g)].map((m) => m[0]);
}

const EXECUTABLE = new Set(['mvnw', 'gradlew']);
/** Copied byte for byte: no token rendering. */
const BINARY = /\.(jar|png|jpg|gif|ico)$/;

/** Copy a template directory, rendering names and contents. Returns the list of written files. */
export function copyTemplate(srcDir, destDir, vars) {
  const written = [];
  const walk = (src, dest) => {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      const from = join(src, entry);
      const renderedName = render(entry, vars);
      const to = join(dest, renderedName);
      if (statSync(from).isDirectory()) {
        walk(from, to);
        continue;
      }
      if (BINARY.test(entry)) {
        copyFileSync(from, to);
        written.push(to);
        continue;
      }
      const content = render(readFileSync(from, 'utf8'), vars);
      const unresolved = findUnresolvedTokens(content);
      if (unresolved.length > 0) {
        throw new Error(`Unresolved template tokens ${[...new Set(unresolved)].join(', ')} in ${from}`);
      }
      writeFileSync(to, content);
      if (EXECUTABLE.has(entry)) chmodSync(to, 0o755);
      written.push(to);
    }
  };
  walk(srcDir, destDir);
  return written;
}

export function isNonEmptyDir(path) {
  return existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length > 0;
}
