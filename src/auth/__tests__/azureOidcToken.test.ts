import { fetchAzureOidcToken } from "../azureOidcToken";
import { installMockFetch, ok, notOk } from "./helpers";

const oidcRequestUri =
    "https://vstoken.dev.azure.com/00000000-0000-0000-0000-000000000000/_apis/distributedtask/hubs/build/plans/p/jobs/j/oidctoken";
const serviceConnectionId = "11111111-2222-3333-4444-555555555555";

let mockFetch: jest.Mock;

beforeEach(() => {
    mockFetch = installMockFetch();
});

describe("fetchAzureOidcToken", () => {
    it("POSTs to System.OidcRequestUri with the right query string and bearer token, returning oidcToken", async () => {
        mockFetch.mockResolvedValueOnce(ok({ oidcToken: "the-jwt" }));

        const jwt = await fetchAzureOidcToken({
            oidcRequestUri,
            adoAccessToken: "ado-token",
            serviceConnectionId,
        });

        expect(jwt).toBe("the-jwt");
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
        const parsed = new URL(url);
        expect(parsed.origin + parsed.pathname).toBe(oidcRequestUri);
        expect(parsed.searchParams.get("api-version")).toBe("7.1-preview.1");
        expect(parsed.searchParams.get("serviceConnectionId")).toBe(serviceConnectionId);
        expect(init.method).toBe("POST");
        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe("Bearer ado-token");
        expect(headers.Accept).toBe("application/json");
        expect(headers["Content-Length"]).toBe("0");
    });

    it("throws AzureOidcTokenError on non-2xx with status and body", async () => {
        mockFetch.mockResolvedValueOnce(notOk(403, "forbidden"));

        await expect(
            fetchAzureOidcToken({
                oidcRequestUri,
                adoAccessToken: "ado-token",
                serviceConnectionId,
            }),
        ).rejects.toMatchObject({
            name: "AzureOidcTokenError",
            status: 403,
            body: "forbidden",
        });
    });

    it("throws AzureOidcTokenError when the response body has no oidcToken", async () => {
        mockFetch.mockResolvedValueOnce(ok({}));

        await expect(
            fetchAzureOidcToken({
                oidcRequestUri,
                adoAccessToken: "ado-token",
                serviceConnectionId,
            }),
        ).rejects.toMatchObject({
            name: "AzureOidcTokenError",
            body: "response missing oidcToken",
        });
    });
});
