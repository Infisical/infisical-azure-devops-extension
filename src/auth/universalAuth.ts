import { AuthMethod, InfisicalAuthError, LoginResponse } from "./types";

export interface UniversalAuthInput {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    timeoutMs?: number;
}

export async function loginWithUniversalAuth(input: UniversalAuthInput): Promise<LoginResponse> {
    const url = new URL("/api/v1/auth/universal-auth/login", input.baseUrl).toString();
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ clientId: input.clientId, clientSecret: input.clientSecret }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 15000),
    });
    if (!response.ok) {
        throw new InfisicalAuthError(response.status, await response.text(), AuthMethod.UniversalAuth);
    }
    return (await response.json()) as LoginResponse;
}
