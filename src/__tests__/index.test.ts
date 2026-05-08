import {
    captureStdout,
    clearTaskEnv,
    parseSetVariables,
    resetTaskLibLoadFlag,
    setEndpoint,
    setInput,
} from "./helpers";
import { AuthMethod } from "../auth/types";

const CONNECTION_ID = "infisicalConnection";
const BASE_URL = "https://app.infisical.com";

const loginMock = jest.fn();
const fetchAzureOidcTokenMock = jest.fn();
const listSecretsMock = jest.fn();

jest.mock("../auth", () => ({
    ...jest.requireActual("../auth"),
    login: (...args: unknown[]) => loginMock(...args),
}));

jest.mock("../auth/azureOidcToken", () => ({
    fetchAzureOidcToken: (...args: unknown[]) => fetchAzureOidcTokenMock(...args),
}));

jest.mock("../secrets", () => ({
    listSecrets: (...args: unknown[]) => listSecretsMock(...args),
}));

describe("InfisicalSecrets task input wiring", () => {
    beforeEach(() => {
        jest.resetModules();
        resetTaskLibLoadFlag();
        clearTaskEnv();
        loginMock.mockReset();
        fetchAzureOidcTokenMock.mockReset();
        listSecretsMock.mockReset();
    });

    afterEach(() => {
        clearTaskEnv();
    });

    it("dispatches Universal Auth credentials and emits each secret as a masked variable", async () => {
        setEndpoint(CONNECTION_ID, {
            url: BASE_URL,
            scheme: "UsernamePassword",
            parameters: { username: "client-id-1", password: "client-secret-1" },
        });
        setInput("infisicalConnection", CONNECTION_ID);
        setInput("projectId", "ws-1");
        setInput("environment", "dev");
        setInput("secretPath", "/app");

        loginMock.mockResolvedValue({
            accessToken: "tok",
            expiresIn: 3600,
            accessTokenMaxTTL: 7200,
            tokenType: "Bearer",
        });
        listSecretsMock.mockResolvedValue({
            secrets: [
                {
                    id: "s1",
                    secretKey: "DB_URL",
                    secretValue: "postgres://example",
                    environment: "dev",
                    secretPath: "/app",
                },
                {
                    id: "s2",
                    secretKey: "API_KEY",
                    secretValue: "k",
                    environment: "dev",
                    secretPath: "/app",
                },
            ],
        });

        const capture = captureStdout();
        require("../index");
        const completion = await capture.complete;
        const stdout = capture.stop();

        expect(completion.result).toBe("Succeeded");
        expect(loginMock).toHaveBeenCalledTimes(1);
        expect(loginMock).toHaveBeenCalledWith({
            method: AuthMethod.UniversalAuth,
            baseUrl: BASE_URL,
            clientId: "client-id-1",
            clientSecret: "client-secret-1",
        });
        expect(fetchAzureOidcTokenMock).not.toHaveBeenCalled();
        expect(listSecretsMock).toHaveBeenCalledTimes(1);
        expect(listSecretsMock).toHaveBeenCalledWith({
            baseUrl: BASE_URL,
            accessToken: "tok",
            projectId: "ws-1",
            environment: "dev",
            secretPath: "/app",
        });

        const setVars = parseSetVariables(stdout);
        expect(setVars).toEqual([
            { name: "DB_URL", value: "postgres://example", isSecret: true, isOutput: false },
            { name: "API_KEY", value: "k", isSecret: true, isOutput: false },
        ]);
    });

    it("dispatches OIDC credentials by minting a federated JWT and forwarding it to login", async () => {
        setEndpoint(CONNECTION_ID, {
            url: BASE_URL,
            scheme: "None",
            parameters: { identityId: "machine-id-1" },
        });
        process.env["SYSTEM_OIDCREQUESTURI"] =
            "https://dev.azure.com/org/_apis/distributedtask/hubs/build/plans/abc/jobs/xyz/oidctoken";
        process.env["ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN"] = "ado-bearer-xyz";
        setInput("infisicalConnection", CONNECTION_ID);
        setInput("projectId", "ws-1");
        setInput("environment", "dev");
        setInput("secretPath", "/app");
        setInput("azureSubscription", "azurerm-conn-1");

        fetchAzureOidcTokenMock.mockResolvedValue("federated-jwt");
        loginMock.mockResolvedValue({
            accessToken: "tok-oidc",
            expiresIn: 3600,
            accessTokenMaxTTL: 7200,
            tokenType: "Bearer",
        });
        listSecretsMock.mockResolvedValue({
            secrets: [
                {
                    id: "s1",
                    secretKey: "OIDC_SECRET",
                    secretValue: "val",
                    environment: "dev",
                    secretPath: "/app",
                },
            ],
        });

        const capture = captureStdout();
        require("../index");
        const completion = await capture.complete;
        const stdout = capture.stop();

        expect(completion.result).toBe("Succeeded");
        expect(fetchAzureOidcTokenMock).toHaveBeenCalledTimes(1);
        expect(fetchAzureOidcTokenMock).toHaveBeenCalledWith({
            oidcRequestUri:
                "https://dev.azure.com/org/_apis/distributedtask/hubs/build/plans/abc/jobs/xyz/oidctoken",
            adoAccessToken: "ado-bearer-xyz",
            serviceConnectionId: "azurerm-conn-1",
        });
        expect(loginMock).toHaveBeenCalledTimes(1);
        expect(loginMock).toHaveBeenCalledWith({
            method: AuthMethod.Oidc,
            baseUrl: BASE_URL,
            identityId: "machine-id-1",
            jwt: "federated-jwt",
        });
        expect(listSecretsMock).toHaveBeenCalledTimes(1);
        expect(listSecretsMock).toHaveBeenCalledWith({
            baseUrl: BASE_URL,
            accessToken: "tok-oidc",
            projectId: "ws-1",
            environment: "dev",
            secretPath: "/app",
        });

        const setVars = parseSetVariables(stdout);
        expect(setVars).toEqual([
            { name: "OIDC_SECRET", value: "val", isSecret: true, isOutput: false },
        ]);
    });

    it("fails when the OIDC service connection has no identityId parameter", async () => {
        setEndpoint(CONNECTION_ID, {
            url: BASE_URL,
            scheme: "None",
        });
        process.env["SYSTEM_OIDCREQUESTURI"] =
            "https://dev.azure.com/org/_apis/distributedtask/hubs/build/plans/abc/jobs/xyz/oidctoken";
        process.env["ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN"] = "ado-bearer-xyz";
        setInput("infisicalConnection", CONNECTION_ID);
        setInput("projectId", "ws-1");
        setInput("environment", "dev");
        setInput("azureSubscription", "azurerm-conn-1");

        const capture = captureStdout();
        require("../index");
        const completion = await capture.complete;
        capture.stop();

        expect(completion.result).toBe("Failed");
        expect(fetchAzureOidcTokenMock).not.toHaveBeenCalled();
        expect(loginMock).not.toHaveBeenCalled();
        expect(listSecretsMock).not.toHaveBeenCalled();
    });

    it("exposes imported secrets and lets direct secrets override imports with the same key", async () => {
        setEndpoint(CONNECTION_ID, {
            url: BASE_URL,
            scheme: "UsernamePassword",
            parameters: { username: "client-id-1", password: "client-secret-1" },
        });
        setInput("infisicalConnection", CONNECTION_ID);
        setInput("projectId", "ws-1");
        setInput("environment", "dev");
        setInput("secretPath", "/app");

        loginMock.mockResolvedValue({
            accessToken: "tok",
            expiresIn: 3600,
            accessTokenMaxTTL: 7200,
            tokenType: "Bearer",
        });
        listSecretsMock.mockResolvedValue({
            secrets: [
                {
                    id: "s1",
                    secretKey: "DIRECT_KEY",
                    secretValue: "direct-value",
                    environment: "dev",
                    secretPath: "/app",
                },
                {
                    id: "s2",
                    secretKey: "SHARED_KEY",
                    secretValue: "direct-wins",
                    environment: "dev",
                    secretPath: "/app",
                },
            ],
            imports: [
                {
                    secretPath: "/shared",
                    environment: "dev",
                    folderId: "folder-1",
                    secrets: [
                        {
                            id: "i1",
                            secretKey: "IMPORTED_KEY",
                            secretValue: "imported-value",
                            environment: "dev",
                        },
                        {
                            id: "i2",
                            secretKey: "SHARED_KEY",
                            secretValue: "imported-loses",
                            environment: "dev",
                        },
                    ],
                },
            ],
        });

        const capture = captureStdout();
        require("../index");
        const completion = await capture.complete;
        const stdout = capture.stop();

        expect(completion.result).toBe("Succeeded");
        expect(completion.message).toBe("Loaded 3 secret(s) from Infisical.");

        const setVars = parseSetVariables(stdout);
        expect(setVars).toEqual([
            { name: "IMPORTED_KEY", value: "imported-value", isSecret: true, isOutput: false },
            { name: "SHARED_KEY", value: "imported-loses", isSecret: true, isOutput: false },
            { name: "DIRECT_KEY", value: "direct-value", isSecret: true, isOutput: false },
            { name: "SHARED_KEY", value: "direct-wins", isSecret: true, isOutput: false },
        ]);
    });
});
