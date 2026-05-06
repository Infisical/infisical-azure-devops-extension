import { loginWithOidc } from "../oidc";
import { installMockFetch, ok, notOk } from "./helpers";

const validResponse = {
    accessToken: "oidc-access-token",
    expiresIn: 7200,
    accessTokenMaxTTL: 43200,
    tokenType: "Bearer" as const,
};

let mockFetch: jest.Mock;

beforeEach(() => {
    mockFetch = installMockFetch();
});

describe("loginWithOidc", () => {
    it("returns the parsed LoginResponse on success", async () => {
        mockFetch.mockResolvedValueOnce(ok(validResponse));

        const result = await loginWithOidc({
            baseUrl: "https://app.infisical.com",
            identityId: "id-1",
            jwt: "azdo-oidc-jwt",
        });

        expect(result).toEqual(validResponse);
    });

    it("POSTs to /api/v1/auth/oidc-auth/login with identityId and jwt in the body", async () => {
        mockFetch.mockResolvedValueOnce(ok(validResponse));

        await loginWithOidc({
            baseUrl: "https://app.infisical.com",
            identityId: "id-1",
            jwt: "azdo-oidc-jwt",
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://app.infisical.com/api/v1/auth/oidc-auth/login");
        expect(init.method).toBe("POST");
        expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
        expect(JSON.parse(init.body as string)).toEqual({
            identityId: "id-1",
            jwt: "azdo-oidc-jwt",
        });
    });

    it("throws InfisicalAuthError on non-2xx with the response body included", async () => {
        mockFetch.mockResolvedValueOnce(notOk(403, "forbidden subject"));

        await expect(
            loginWithOidc({
                baseUrl: "https://app.infisical.com",
                identityId: "id-1",
                jwt: "expired-jwt",
            }),
        ).rejects.toMatchObject({
            name: "InfisicalAuthError",
            status: 403,
            endpoint: "oidc",
            body: "forbidden subject",
        });
    });
});
