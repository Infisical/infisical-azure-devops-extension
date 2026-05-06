export interface InfisicalSecret {
    id: string;
    secretKey: string;
    secretValue: string;
    environment: string;
    secretPath: string;
}

export interface ListSecretsInput {
    baseUrl: string;
    accessToken: string;
    workspaceId: string;
    environment: string;
    secretPath?: string;
    timeoutMs?: number;
}

export interface ListSecretsResponse {
    secrets: InfisicalSecret[];
}

export class InfisicalSecretsError extends Error {
    constructor(
        public readonly status: number,
        public readonly body: string,
    ) {
        super(`Infisical list-secrets failed with status ${status}: ${body}`);
        this.name = "InfisicalSecretsError";
    }
}
