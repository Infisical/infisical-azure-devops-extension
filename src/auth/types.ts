export enum AuthMethod {
    UniversalAuth = "universal-auth",
    Oidc = "oidc",
}

export type LoginRequest =
    | { method: AuthMethod.UniversalAuth; baseUrl: string; clientId: string; clientSecret: string }
    | { method: AuthMethod.Oidc; baseUrl: string; identityId: string; jwt: string };

export interface LoginResponse {
    accessToken: string;
    expiresIn: number;
    accessTokenMaxTTL: number;
    tokenType: "Bearer";
}

export class InfisicalAuthError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: string,
        public readonly endpoint: string,
    ) {
        super(`Infisical ${endpoint} login failed with status ${status}: ${body}`);
        this.name = "InfisicalAuthError";
    }
}
