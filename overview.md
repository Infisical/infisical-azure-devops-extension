# Infisical Secrets for Azure DevOps

Fetch secrets from [Infisical](https://infisical.com) at pipeline run-time and expose them as masked variables for any subsequent step. Works with Infisical Cloud or a self-hosted instance.

## Features

- **Two authentication methods** — Universal Auth (Client ID + Client Secret) or OIDC via Azure Workload Identity Federation, so you can avoid long-lived credentials entirely.
- **Cloud and self-hosted** — point the service connection at `https://app.infisical.com` or your own Infisical URL; the same task works against both.
- **Masked by default** — every fetched secret is registered as a secret pipeline variable, so its value is masked in pipeline logs and downstream `$(KEY)` references.
- **Scoped fetches** — choose the project, environment slug, and folder path on each task invocation.
- **No SDK dependency** — direct, dependency-light HTTP calls to Infisical's public API with a 15s timeout.

## Quickstart

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

  - script: |
      echo "DATABASE_URL is set: ${DATABASE_URL:+yes}"
    displayName: Use the fetched secrets
    env:
      DATABASE_URL: $(DATABASE_URL)
```

Each fetched secret becomes a masked pipeline variable named after its Infisical key. Reference it later with `$(KEY)`, or map it into an `env:` block as shown above.

## Authentication

Authentication is performed against an Infisical [Machine Identity](https://infisical.com/docs/documentation/platform/identities/machine-identities). Choose the scheme when you create the **Infisical** service connection.

### Universal Auth

Pick [Universal Auth](https://infisical.com/docs/documentation/platform/identities/universal-auth) and paste the machine identity's **Client ID** and **Client Secret**. The Client Secret is stored encrypted by Azure DevOps and cannot be retrieved after creation.

### OIDC

Pick [OIDC](https://infisical.com/docs/documentation/platform/identities/oidc-auth/azure) and provide the Infisical machine identity ID in the connection's **Identity ID** field. At pipeline run-time, the task mints a federated OIDC JWT from an Azure Resource Manager service connection (configured with Workload Identity Federation) and exchanges it for an Infisical access token. To use OIDC, also supply the `azureSubscription` task input pointing at that Azure RM connection.

## Self-hosted Infisical

Set the **Infisical URL** field on the service connection to your self-hosted base URL (e.g. `https://infisical.mycorp.example`). The task uses this URL for both the auth login call and the secrets fetch.

## Inputs

| Name                  | Required  | Default | Description                                                                                |
| --------------------- | --------- | ------- | ------------------------------------------------------------------------------------------ |
| `infisicalConnection` | Yes       | —       | Name of the Infisical service connection.                                                  |
| `azureSubscription`   | OIDC only | —       | Azure RM service connection (Workload Identity Federation) used to mint a federated token. |
| `projectId`           | Yes       | —       | Infisical project (workspace) ID. Find it under **Project settings → General**.            |
| `environment`         | Yes       | `dev`   | Environment slug (e.g. `dev`, `staging`, `prod`).                                          |
| `secretPath`          | No        | `/`     | Folder path within the environment.                                                        |

## Links

- [GitHub repository](https://github.com/Infisical/infisical-azure-devops-extension) — source, issues, and full README
- [Infisical documentation](https://infisical.com/docs)
- [Community Slack](https://infisical.com/slack)

## License

MIT.
