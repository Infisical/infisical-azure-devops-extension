import { InfisicalSecretsError, ListSecretsInput, ListSecretsResponse } from "./types";

export async function listSecrets(input: ListSecretsInput): Promise<ListSecretsResponse> {
    const url = new URL("/api/v4/secrets", input.baseUrl);
    url.searchParams.set("projectId", input.projectId);
    url.searchParams.set("environment", input.environment);
    if (input.secretPath) url.searchParams.set("secretPath", input.secretPath);

    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${input.accessToken}`,
            Accept: "application/json",
        },
        signal: AbortSignal.timeout(input.timeoutMs ?? 15000),
    });
    if (!response.ok) {
        throw new InfisicalSecretsError(response.status, await response.text());
    }
    return (await response.json()) as ListSecretsResponse;
}
