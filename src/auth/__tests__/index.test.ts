import { login, LoginRequest } from "../index";
import { installMockFetch, ok } from "./helpers";

const okResponse = {
    accessToken: "tok",
    expiresIn: 60,
    accessTokenMaxTTL: 60,
    tokenType: "Bearer" as const,
};

let mockFetch: jest.Mock;

beforeEach(() => {
    mockFetch = installMockFetch();
    mockFetch.mockResolvedValue(ok(okResponse));
});

describe("login dispatcher", () => {
    it("routes universal-auth to /api/v1/auth/universal-auth/login", async () => {
        await login({
            method: "universal-auth",
            baseUrl: "https://app.infisical.com",
            clientId: "id",
            clientSecret: "secret",
        });

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://app.infisical.com/api/v1/auth/universal-auth/login");
    });

    it("routes oidc to /api/v1/auth/oidc-auth/login", async () => {
        await login({
            method: "oidc",
            baseUrl: "https://app.infisical.com",
            identityId: "id-1",
            jwt: "jwt",
        });

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://app.infisical.com/api/v1/auth/oidc-auth/login");
    });

    it("throws on an unsupported method (defensive guard against bypassed types)", async () => {
        const bad = { method: "bogus", baseUrl: "https://x" } as unknown as LoginRequest;
        await expect(login(bad)).rejects.toThrow(/Unsupported Infisical auth method/);
    });
});
