export function ok(body: unknown): Response {
    return {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
    } as unknown as Response;
}

export function notOk(status: number, body: string): Response {
    return {
        ok: false,
        status,
        json: async () => JSON.parse(body),
        text: async () => body,
    } as unknown as Response;
}

export function installMockFetch(): jest.Mock {
    const mockFetch = jest.fn();
    (globalThis as unknown as { fetch: jest.Mock }).fetch = mockFetch;
    return mockFetch;
}
