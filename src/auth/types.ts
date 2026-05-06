export type LoginRequest =
    | { method: "universal-auth"; baseUrl: string; clientId: string; clientSecret: string }
    | { method: "oidc"; baseUrl: string; identityId: string; jwt: string };

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
