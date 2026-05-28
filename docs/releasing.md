# Releasing MiniWeb

MiniWeb publishes to npm as `@async/miniweb`.

## Normal Release Flow

MiniWeb includes Release Please config for changelog and version PRs. Merge Conventional Commit changes into `main`; then create a release PR with Release Please once GitHub Actions PR creation is enabled for the `async-framework` organization or a dedicated release token is configured.

When the release PR merges, push the release tag. The `Release` workflow verifies the package, publishes to npm through Trusted Publishing, creates the GitHub Release if needed, and attaches the exact packed tarball to the GitHub Release.

## npm Trusted Publishing

Configure npm Trusted Publishing for this package before the first automated publish:

- npm package: `@async/miniweb`
- GitHub owner/repository: `async-framework/miniweb`
- Workflow filename: `release.yml`
- Environment: leave unset unless npm requires one for the package

The workflow uses GitHub OIDC with `id-token: write`; it does not use an `NPM_TOKEN` secret.

The repository workflow is tag-triggered because the `async-framework` organization currently blocks `GITHUB_TOKEN` from creating pull requests. To let Release Please open changelog PRs from Actions, an organization admin must allow GitHub Actions to create pull requests, or the workflow must be updated to use a dedicated release token.

## First Release

The first package version is `0.1.0`. It was published manually from a verified tarball because npm Trusted Publishing can only be configured after the package exists. Future releases should use the tag-triggered workflow after Trusted Publishing is configured.

```sh
npm run release:check
git tag vX.Y.Z
git push origin main vX.Y.Z
```

## Local Verification

Run this before tagging or merging a release PR:

```sh
npm run release:check
```

This runs typecheck, tests, build, and `npm pack --dry-run`.

## Local AI Changelog Polish

AI may be used locally to improve changelog wording before a release PR merges, but it should stay outside the trusted publish workflow. Only feed generated changelog text, public commit subjects, and relevant file lists to the local model. Do not feed secrets, npm config, tokens, environment files, browser profiles, or credential paths into AI tooling.
