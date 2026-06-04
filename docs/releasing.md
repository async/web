# Releasing Async Web

This workspace publishes one npm package:

- `@async/web`

`@async/web/runtime` and `@async/web/router` are public subpath exports from `@async/web`. The runtime and router workspace packages are private implementation packages until we decide to publish them separately.

## Normal Release Flow

Use the workspace release gate before tagging:

```sh
pnpm release:check
```

This runs package typechecks, tests, builds, and `npm pack --dry-run` for the publishable package through the workspace `pack:check` scripts.

When a release tag is pushed, the `Release` workflow installs with pnpm, verifies the workspace, packs `@async/web`, publishes it to npm, creates the GitHub Release if needed, and uploads the tarball.

## npm Trusted Publishing

Configure npm Trusted Publishing for the package:

- npm package: `@async/web`
- GitHub owner/repository: `async-framework/async-web`
- Workflow filename: `release.yml`
- Environment: leave unset unless npm requires one for the package

The workflow uses GitHub OIDC with `id-token: write`; it does not use an `NPM_TOKEN` secret.

## Local Verification

Run this before tagging or merging a release PR:

```sh
pnpm release:check
```

For package-local verification:

```sh
pnpm --filter @async/web typecheck
```

## Migration Note

The package split replaces the earlier single-package release. Existing consumers should follow the migration guide and move to `@async/web` or its `@async/web/runtime` subpath by responsibility.

## Local AI Changelog Polish

AI may be used locally to improve changelog wording before a release PR merges, but it should stay outside the trusted publish workflow. Only feed generated changelog text, public commit subjects, and relevant file lists to the local model. Do not feed secrets, npm config, tokens, environment files, browser profiles, or credential paths into AI tooling.
