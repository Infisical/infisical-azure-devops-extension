# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install                  # legacy-peer-deps=true is set in .npmrc
npm test                     # jest only
npm run compile              # tsc --noEmit + jest (typecheck + tests)
npm run build                # clean + compile + bundle task with @vercel/ncc
npm run package-extension    # build + tfx extension create -> .vsix
npm run publish-extension    # build + tfx extension publish
```

Run a single test file or pattern:

```sh
npx jest src/auth/__tests__/universalAuth.test.ts
npx jest -t "universal auth"
```

Tests live under `src/**/__tests__/**/*.test.ts` (configured in `package.json` jest block). `src/auth/__tests__/helpers.ts` provides `ok` / `notOk` / `installMockFetch` for stubbing the global `fetch` — use these instead of rolling new mocks.

## Architecture

The repo ships **two contributions** in one Azure DevOps extension, declared in `vss-extension.json`:

1. A **service connection type** named `Infisical` (`ms.vss-endpoint.service-endpoint-type`). It exposes a URL field plus two auth schemes:
   - `Universal Auth` — `ms.vss-endpoint.endpoint-auth-scheme-basic`, where `username` = Infisical Client ID and `password` = Client Secret. The task reads these via `tl.getEndpointAuthorizationParameterRequired(connectionId, "username"|"password")` and the scheme arrives as the literal string `UsernamePassword` (see `SCHEME_BASIC` in `src/index.ts`).
   - `OIDC` — `ms.vss-endpoint.endpoint-auth-scheme-none`. The task mints an Azure DevOps federated OIDC JWT via `fetchAzureOidcToken` (`src/auth/azureOidcToken.ts`) and exchanges it at `/api/v1/auth/oidc-auth/login`. OIDC requires two extra task inputs — `azureSubscription` (an `AzureRM` connected service configured with Workload Identity Federation) and `identityId` (the Infisical machine identity ID). The flow needs `System.OidcRequestUri` and `System.AccessToken` from a federated agent (Microsoft-hosted, or self-hosted on agent 3.225+).
2. A **pipeline task** `InfisicalSecrets@0` (`ms.vss-distributed-task.task`). Entry point at `src/index.ts`; manifest at `src/task.json`. The task is bundled to a single `dist/tasks/run/index.js` via `@vercel/ncc` — the `build:task` script also copies `task.json` and `logo.png` (renamed to `icon.png`) into the output, because `vss-extension.json` packages `dist/tasks/run` as the task's directory.

Internal layout:

- `src/auth/` — `index.ts` is a method-discriminated dispatcher (`login({ method: "universal-auth" | "oidc", ... })`). Each strategy hits a different Infisical endpoint (`/api/v1/auth/universal-auth/login`, `/api/v1/auth/oidc-auth/login`). Both throw `InfisicalAuthError` (status + body + endpoint) on non-2xx. The `default` arm uses an exhaustiveness check via `never` — keep that pattern when adding methods. `azureOidcToken.ts` is a separate helper that calls Azure DevOps' `oidctoken` endpoint to mint the federated JWT used by the OIDC strategy; non-2xx responses (and missing `oidcToken` bodies) throw `AzureOidcTokenError`.
- `src/secrets/` — thin wrapper over `GET /api/v3/secrets/raw` returning `{ secrets: InfisicalSecret[] }`. Errors throw `InfisicalSecretsError`.
- `src/index.ts` — the runtime entrypoint. Reads inputs, calls `login`, calls `listSecrets`, and emits each secret with `tl.setVariable(name, value, true)` — the third arg `true` masks the value in pipeline logs and **must stay** for every secret variable.

All HTTP calls use the platform's global `fetch` with `AbortSignal.timeout(...)` (default 15s). There is no Infisical SDK dependency by design — keep new HTTP calls in the same shape.

## Versioning

Three places hold versions and they are **not** auto-synced:

- `package.json` `version` — npm package metadata, not user-facing.
- `vss-extension.json` `version` — the marketplace extension version. Must be bumped on every publish.
- `src/task.json` `version` (Major/Minor/Patch) — the pipeline task version. Bump when the task's behavior or inputs change; pipelines pin via `InfisicalSecrets@<Major>`.

When changing inputs in `task.json`, update the README "Inputs" table and `samples/azure-pipelines.yml` to match.
