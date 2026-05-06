import { InfisicalAuthError, LoginResponse } from "./types";

export interface OidcAuthInput {
    baseUrl: string;
    identityId: string;
    jwt: string;
    timeoutMs?: number;
}

export async function loginWithOidc(input: OidcAuthInput): Promise<LoginResponse> {
    const url = new URL("/api/v1/auth/oidc-auth/login", input.baseUrl).toString();
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ identityId: input.identityId, jwt: input.jwt }),
        signal: AbortSignal.timeout(input.timeoutMs ?? 15000),
    });
    if (!response.ok) {
        throw new InfisicalAuthError(response.status, await response.text(), "oidc");
    }
    return (await response.json()) as LoginResponse;
}
