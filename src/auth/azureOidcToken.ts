export interface AzureOidcTokenInput {
    oidcRequestUri: string;
    adoAccessToken: string;
    serviceConnectionId: string;
    timeoutMs?: number;
}

export class AzureOidcTokenError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: string,
    ) {
        super(`Azure OIDC token request failed with status ${status}: ${body}`);
        this.name = "AzureOidcTokenError";
    }
}

export async function fetchAzureOidcToken(input: AzureOidcTokenInput): Promise<string> {
    const url = new URL(input.oidcRequestUri);
    url.searchParams.set("api-version", "7.1-preview.1");
    url.searchParams.set("serviceConnectionId", input.serviceConnectionId);

    const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
            Authorization: `Bearer ${input.adoAccessToken}`,
            Accept: "application/json",
            "Content-Length": "0",
        },
        signal: AbortSignal.timeout(input.timeoutMs ?? 15000),
    });
    if (!response.ok) {
        throw new AzureOidcTokenError(response.status, await response.text());
    }
    const body = (await response.json()) as { oidcToken?: string };
    if (!body.oidcToken) {
        throw new AzureOidcTokenError(response.status, "response missing oidcToken");
    }
    return body.oidcToken;
}
