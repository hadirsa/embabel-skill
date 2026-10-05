# Contributing

Thanks for helping improve Embabeler. The full rules for contributors and coding agents are in [AGENTS.md](AGENTS.md); this is the short version.

## Principles

- Do not invent code. Every Java snippet in the docs must be an excerpt of code that is compiled and tested here, or be marked as copied from an official source.
- Back every behavioural claim with a test.
- Versions live in [versions.json](versions.json). Do not hard-code them in docs; run `node scripts/sync-versions-in-docs.mjs` after changing them.

## Before opening a pull request

```bash
npm test
```

```bash
node scripts/verify-scaffold.mjs --with-cookbook
```

For Kotlin or Gradle changes, also run `node scripts/verify-scaffold.mjs --kotlin` and the `--gradle` variants, as CI does.

## Pull requests

- Keep each pull request focused on one change.
- Add an entry to [CHANGELOG.md](CHANGELOG.md).
- Describe what you verified and how.

## License

By contributing you agree that your contributions are licensed under the Apache License 2.0.
