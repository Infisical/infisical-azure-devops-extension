import * as tl from "azure-pipelines-task-lib/task";
import { AuthMethod, login } from "./auth";
import { fetchAzureOidcToken } from "./auth/azureOidcToken";
import { listSecrets } from "./secrets";

const SCHEME_BASIC = "UsernamePassword";
const SCHEME_NONE = "None"; // assume that if nothing was sent, it's OIDC

async function getAccessToken(connectionId: string, baseUrl: string): Promise<string> {
    const scheme = tl.getEndpointAuthorizationSchemeRequired(connectionId);
    if (scheme === SCHEME_BASIC) return getAccessTokenUniversal(connectionId, baseUrl);
    if (scheme === SCHEME_NONE) return getAccessTokenOidc(baseUrl);
    throw new Error(
        `Unsupported authentication scheme on Infisical service connection: ${scheme}`,
    );
}

async function getAccessTokenUniversal(connectionId: string, baseUrl: string): Promise<string> {
    const clientId = tl.getEndpointAuthorizationParameterRequired(connectionId, "username");
    const clientSecret = tl.getEndpointAuthorizationParameterRequired(connectionId, "password");
    const result = await login({
        method: AuthMethod.UniversalAuth,
        baseUrl,
        clientId,
        clientSecret,
    });
    return result.accessToken;
}

async function getAccessTokenOidc(baseUrl: string): Promise<string> {
    const azureSubscription = tl.getInputRequired("azureSubscription");
    const identityId = tl.getEndpointAuthorizationParameterRequired(azureSubscription, "identityId");

    const oidcRequestUri = tl.getVariable("System.OidcRequestUri");
    if (!oidcRequestUri) {
        throw new Error(
            "System.OidcRequestUri is not set. The OIDC scheme requires a federated Azure DevOps agent (Microsoft-hosted, or self-hosted on agent 3.225+).",
        );
    }
    const adoAccessToken = tl.getEndpointAuthorizationParameter(
        "SYSTEMVSSCONNECTION",
        "AccessToken",
        false,
    );
    if (!adoAccessToken) {
        throw new Error("Could not obtain System.AccessToken from SYSTEMVSSCONNECTION.");
    }

    const jwt = await fetchAzureOidcToken({
        oidcRequestUri,
        adoAccessToken,
        serviceConnectionId: azureSubscription,
    });

    const result = await login({
        method: AuthMethod.Oidc,
        baseUrl,
        identityId,
        jwt,
    });
    return result.accessToken;
}

async function run(): Promise<void> {
    try {
        const connectionId = tl.getInputRequired("infisicalConnection");
        const projectId = tl.getInputRequired("projectId");
        const environment = tl.getInputRequired("environment");
        const secretPath = tl.getInput("secretPath", false) || "/";

        const baseUrl = tl.getEndpointUrlRequired(connectionId);
        const accessToken = await getAccessToken(connectionId, baseUrl);

        const result = await listSecrets({
            baseUrl,
            accessToken,
            projectId,
            environment,
            secretPath,
        });

        const allSecrets = [
            ...(result.imports ?? []).flatMap((i) => i.secrets),
            ...result.secrets,
        ];

        for (const secret of allSecrets) {
            tl.setVariable(secret.secretKey, secret.secretValue, true);
        }

        const uniqueCount = new Set(allSecrets.map((s) => s.secretKey)).size;

        tl.setResult(
            tl.TaskResult.Succeeded,
            `Loaded ${uniqueCount} secret(s) from Infisical.`,
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        tl.setResult(tl.TaskResult.Failed, message);
    }
}

void run();
