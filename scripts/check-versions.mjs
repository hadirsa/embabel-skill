#!/usr/bin/env node
// Reports drift between versions.json and the newest Embabel release on Maven Central.
// Exit code 1 when a newer release exists, so a scheduled CI job can flag it.
//
//   node scripts/check-versions.mjs
import { fetchLatestEmbabelRelease, loadVersions } from './lib/versions.mjs';

const pinned = loadVersions().embabelAgentVersion;
try {
  const latest = await fetchLatestEmbabelRelease();
  if (latest === pinned) {
    console.log(`Up to date: Embabel ${pinned}`);
  } else {
    console.log(`Embabel ${latest} is available (pinned: ${pinned}).`);
    console.log(`Try it first:  node scripts/verify-scaffold.mjs --embabel-version ${latest}`);
    console.log('If it passes, bump versions.json, then run: node scripts/sync-versions-in-docs.mjs');
    process.exit(1);
  }
} catch (error) {
  console.error(`Could not check versions: ${error.message}`);
  process.exit(2);
}
