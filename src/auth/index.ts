import { LoginRequest, LoginResponse } from "./types";
import { loginWithUniversalAuth } from "./universalAuth";
import { loginWithOidc } from "./oidc";

export async function login(request: LoginRequest): Promise<LoginResponse> {
    switch (request.method) {
        case "universal-auth":
            return loginWithUniversalAuth({
                baseUrl: request.baseUrl,
                clientId: request.clientId,
                clientSecret: request.clientSecret,
            });
        case "oidc":
            return loginWithOidc({
                baseUrl: request.baseUrl,
                identityId: request.identityId,
                jwt: request.jwt,
            });
        default: {
            const exhaustive: never = request;
            throw new Error(
                `Unsupported Infisical auth method: ${(exhaustive as { method: string }).method}`,
            );
        }
    }
}

export type { LoginRequest, LoginResponse } from "./types";
export { InfisicalAuthError } from "./types";
