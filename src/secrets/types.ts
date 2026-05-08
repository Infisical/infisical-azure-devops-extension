export interface InfisicalSecret {
    id: string;
    secretKey: string;
    secretValue: string;
    environment: string;
    secretPath?: string;
}

export interface InfisicalSecretImport {
    secretPath: string;
    environment: string;
    folderId?: string;
    secrets: InfisicalSecret[];
}

export interface ListSecretsInput {
    baseUrl: string;
    accessToken: string;
    projectId: string;
    environment: string;
    secretPath?: string;
    timeoutMs?: number;
}

export interface ListSecretsResponse {
    secrets: InfisicalSecret[];
    imports?: InfisicalSecretImport[];
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
