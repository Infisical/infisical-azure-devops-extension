import { loginWithUniversalAuth } from "../universalAuth";
import { installMockFetch, ok, notOk } from "./helpers";

const validResponse = {
    accessToken: "test-access-token",
    expiresIn: 2592000,
    accessTokenMaxTTL: 2592000,
    tokenType: "Bearer" as const,
};

let mockFetch: jest.Mock;

beforeEach(() => {
    mockFetch = installMockFetch();
});

describe("loginWithUniversalAuth", () => {
    it("returns the parsed LoginResponse on success", async () => {
        mockFetch.mockResolvedValueOnce(ok(validResponse));

        const result = await loginWithUniversalAuth({
            baseUrl: "https://app.infisical.com",
            clientId: "client-id-1",
            clientSecret: "client-secret-1",
        });

        expect(result).toEqual(validResponse);
    });

    it("POSTs to /api/v1/auth/universal-auth/login with the credentials in the body", async () => {
        mockFetch.mockResolvedValueOnce(ok(validResponse));

        await loginWithUniversalAuth({
            baseUrl: "https://app.infisical.com",
            clientId: "client-id-1",
            clientSecret: "client-secret-1",
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://app.infisical.com/api/v1/auth/universal-auth/login");
        expect(init.method).toBe("POST");
        expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
        expect(JSON.parse(init.body as string)).toEqual({
            clientId: "client-id-1",
            clientSecret: "client-secret-1",
        });
    });

    it("trims a trailing slash on the base URL", async () => {
        mockFetch.mockResolvedValueOnce(ok(validResponse));

        await loginWithUniversalAuth({
            baseUrl: "https://app.infisical.com/",
            clientId: "x",
            clientSecret: "y",
        });

        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://app.infisical.com/api/v1/auth/universal-auth/login");
    });

    it("throws InfisicalAuthError with the response body when the request fails", async () => {
        mockFetch.mockResolvedValueOnce(notOk(401, '{"message":"invalid credentials"}'));

        await expect(
            loginWithUniversalAuth({
                baseUrl: "https://app.infisical.com",
                clientId: "bad",
                clientSecret: "bad",
            }),
        ).rejects.toMatchObject({
            name: "InfisicalAuthError",
            status: 401,
            endpoint: "universal-auth",
            body: '{"message":"invalid credentials"}',
        });
    });
});
