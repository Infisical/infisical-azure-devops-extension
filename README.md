# Infisical Secrets for Azure DevOps

Azure DevOps extension that fetches secrets from [Infisical](https://infisical.com) and exposes them as masked pipeline variables. Works with Infisical Cloud or a self-hosted instance.

The extension contributes:

- A **service connection** type (`Infisical`) that holds the URL of your Infisical instance and machine-identity credentials.
- A pipeline **task** (`InfisicalSecrets@0`) that consumes the connection, fetches secrets, and exposes each one as a secret pipeline variable for subsequent steps.

## Authentication

Authentication is performed against Infisical [Machine Identities](https://infisical.com/docs/documentation/platform/identities/machine-identities). Two methods are supported by the service connection:

### Universal Auth

[Universal Auth](https://infisical.com/docs/documentation/platform/identities/universal-auth) — Client ID + Client Secret.

When you create the service connection, pick **Universal Auth** as the authentication method and paste the machine identity's Client ID and Client Secret. The Client Secret is stored confidentially.

### OIDC

[OIDC Auth](https://infisical.com/docs/documentation/platform/identities/oidc-auth) — no credentials at connection-creation time.

When you create the Infisical service connection, pick **OIDC** and leave the form blank. At pipeline run-time the task mints a federated OIDC JWT from an Azure Resource Manager service connection (Workload Identity Federation) and exchanges it for an Infisical access token.

To use OIDC you must also provide two task inputs:

- `azureSubscription` — an Azure RM service connection configured with Workload Identity Federation.
- `identityId` — the ID of the Infisical machine identity that accepts your Azure DevOps issuer.

#### OIDC setup

1. **Create an Azure RM service connection with Workload Identity Federation** in Azure DevOps (**Project settings → Service connections → New → Azure Resource Manager → Workload Identity Federation**).
2. **Create the Infisical machine identity** with an OIDC auth method:
   - **Issuer**: `https://vstoken.dev.azure.com/<your-azure-devops-org-guid>`
   - **Audience**: `api://AzureADTokenExchange` (this is the default audience Azure DevOps uses for federated tokens; an audience mismatch is the most common misconfiguration)
   - Configure the subject and other allowed claims to match the Azure RM service connection's federated subject.
3. **Create the Infisical service connection** in Azure DevOps with the **OIDC** authentication scheme.
4. **Wire both connections into the task** — see the OIDC sample in [`samples/azure-pipelines.yml`](samples/azure-pipelines.yml).

## Setup

### 1. Install the extension

For private testing, build the `.vsix` and upload it to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/manage) as a private extension under your publisher, then share with your Azure DevOps organization.

```sh
npm install
npm run package-extension
# adilsitos-validation.test-secrets-action-azure-1.0.0.vsix
```

### 2. Create the service connection

In your Azure DevOps project: **Project settings → Service connections → New service connection → Infisical**.

| Field                  | Value                                                                |
| ---------------------- | -------------------------------------------------------------------- |
| Infisical URL          | `https://app.infisical.com` (or your self-hosted URL)                |
| Authentication Method  | `Universal Auth`                                                     |
| Client ID              | Your machine identity's Client ID                                    |
| Client Secret          | Your machine identity's Client Secret                                |
| Service Connection Name| Whatever you want to reference from your pipeline (e.g. `infisical`) |

### 3. Use the task in a pipeline

```yaml
trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - task: InfisicalSecrets@0
    displayName: Fetch secrets from Infisical
    inputs:
      infisicalConnection: infisical
      projectId: $(INFISICAL_PROJECT_ID)
      environment: dev
      secretPath: /
      recursive: false

  - script: |
      echo "DATABASE_URL is set: ${DATABASE_URL:+yes}"
    displayName: Use the fetched secrets
    env:
      DATABASE_URL: $(DATABASE_URL)
```

Each fetched secret becomes a masked pipeline variable named after its Infisical key. Reference them in later steps with `$(KEY)` or by mapping them into `env:` blocks as shown above.

## Inputs

| Name                  | Required        | Default | Description                                                                                                                                                       |
| --------------------- | --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infisicalConnection` | Yes             | —       | Name of the Infisical service connection.                                                                                                                         |
| `azureSubscription`   | OIDC only       | —       | Azure RM service connection (Workload Identity Federation) used to mint a federated OIDC token. Required when the Infisical connection uses the OIDC scheme.      |
| `identityId`          | OIDC only       | —       | Infisical machine identity ID to authenticate as. Required when the Infisical connection uses the OIDC scheme.                                                    |
| `projectId`           | Yes             | —       | The Infisical project (workspace) ID. Find it under **Project settings → General** in the Infisical UI.                                                           |
| `environment`         | Yes             | `dev`   | The environment slug (e.g. `dev`, `staging`, `prod`).                                                                                                             |
| `secretPath`          | No              | `/`     | Folder path within the environment.                                                                                                                               |
| `recursive`           | No              | `false` | If `true`, fetches secrets from sub-folders recursively.                                                                                                          |
| `variablePrefix`      | No              | (empty) | Prefix prepended to each pipeline variable name. Useful for namespacing or to avoid collisions between secrets and other pipeline variables.                      |

## Self-hosted Infisical

Set the **Infisical URL** field on the service connection to your self-hosted base URL (e.g. `https://infisical.mycorp.example`). The task uses this URL for both the auth login call and the secrets fetch.

## Development

```sh
npm install
npm run compile             # tsc --noEmit + jest
npm run build               # compile + bundle the task with ncc
npm run package-extension   # build + tfx extension create -> .vsix
```

Layout:

- `src/auth/` — login strategies for Universal Auth and OIDC, plus a small dispatcher.
- `src/secrets/` — wrapper around Infisical's `GET /api/v3/secrets/raw` endpoint.
- `src/index.ts` — the `InfisicalSecrets` pipeline task entry point. Bundled into a single JS file via `@vercel/ncc` for distribution.
- `src/task.json` — the pipeline task manifest. Copied to `dist/tasks/run/` at build time.
- `vss-extension.json` — the extension manifest. Declares the service-connection contribution and the task contribution.
- `samples/azure-pipelines.yml` — example pipeline.

## License

MIT.
