// Single access point for versions. The source of truth is ../../versions.json.
// Fallbacks keep the scripts usable if the file is missing from a partial copy.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const FALLBACK = {
  embabelAgentVersion: '1.5.2',
  springBootVersion: '4.1.0',
  javaVersion: '25',
  mavenWrapperVersion: '3.9.6',
  gradleVersion: '9.8.0',
  kotlinVersion: '2.3.21',
  foojayResolverVersion: '1.0.0',
};

export function loadVersions() {
  try {
    return { ...FALLBACK, ...JSON.parse(readFileSync(join(root, 'versions.json'), 'utf8')) };
  } catch {
    return { ...FALLBACK };
  }
}

export const MAVEN_METADATA_URL =
  'https://repo1.maven.org/maven2/com/embabel/agent/embabel-agent-starter/maven-metadata.xml';

/** Pure parser so it can be unit tested without the network. */
export function parseLatestRelease(metadataXml) {
  const release = /<release>([^<]+)<\/release>/.exec(metadataXml)?.[1];
  if (release) return release;
  const versions = [...metadataXml.matchAll(/<version>([^<]+)<\/version>/g)]
    .map((m) => m[1])
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  return versions.at(-1) ?? null;
}

export async function fetchLatestEmbabelRelease(fetchImpl = fetch) {
  const res = await fetchImpl(MAVEN_METADATA_URL);
  if (!res.ok) throw new Error(`Maven Central answered HTTP ${res.status}`);
  const latest = parseLatestRelease(await res.text());
  if (!latest) throw new Error('Could not find a release version in Maven Central metadata');
  return latest;
}
