# Releasing Async Web

This workspace publishes one npm package:

- `@async/web`

`@async/web/runtime` and `@async/web/router` are public subpath exports from `@async/web`. The runtime and router workspace packages are private implementation packages until we decide to publish them separately.

## Normal Release Flow

Use the workspace release gate before tagging:

```sh
pnpm run release:check
```

This runs the generated `pipeline:verify` job with a forced pipeline pass. It checks package typechecks, tests, builds, `npm pack --dry-run` for `packages/web`, the API surface ledger, and the GitHub Pages site build.

The generated `Async Pipeline` workflow owns PR previews, main snapshots, stable GitHub Packages mirrors, npm publish, release doctor, and Pages jobs.

## npm Trusted Publishing

Configure npm Trusted Publishing for the package:

- npm package: `@async/web`
- GitHub owner/repository: `async/web`
- Workflow filename: `async-pipeline.yml`
- Environment: leave unset unless npm requires one for the package

The generated stable release job uses the `npm-publish` environment, GitHub OIDC with `id-token: write`, the automatic `github.token` for GitHub Packages and release doctor checks, and `NPM_TOKEN` as `NODE_AUTH_TOKEN` for npm.

## Local Verification

Run this before tagging or merging a release PR:

```sh
pnpm run release:check
```

For package-local verification:

```sh
pnpm --dir packages/web typecheck
```

## Migration Note

The package split replaces the earlier single-package release. Existing consumers should follow the migration guide and move to `@async/web` or its `@async/web/runtime` subpath by responsibility.

## Local AI Changelog Polish

AI may be used locally to improve changelog wording before a release PR merges, but it should stay outside the trusted publish workflow. Only feed generated changelog text, public commit subjects, and relevant file lists to the local model. Do not feed secrets, npm config, tokens, environment files, browser profiles, or credential paths into AI tooling.
