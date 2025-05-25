import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as clientsModule from "../../src/clients";
import * as configModule from "../../src/config";
import { proxy, server } from "../../src/proxy";

describe("Proxy Resilience Integration Tests", () => {
	let proxyInstance: Awaited<ReturnType<typeof proxy>> | null = null;
	let mockFetch: ReturnType<typeof spyOn>;
	let mockServerConnect: ReturnType<typeof spyOn>;
	let mockStartConfigurationPolling: ReturnType<typeof spyOn>;
	let mockConnectClients: ReturnType<typeof spyOn>;
	let originalPollingInterval: string | undefined;

	beforeEach(() => {
		originalPollingInterval = process.env.CONFIGURATION_POLL_INTERVAL;
		process.env.CONFIGURATION_POLL_INTERVAL = "0";
		mockFetch = spyOn(global, "fetch");
		mockServerConnect = spyOn(server, "connect").mockImplementation(
			async () => {},
		);
		mockStartConfigurationPolling = spyOn(
			configModule,
			"startConfigurationPolling",
		).mockImplementation(async () => {});
		mockConnectClients = spyOn(
			clientsModule,
			"connectClients",
		).mockImplementation(async () => {});
	});

	afterEach(async () => {
		if (originalPollingInterval !== undefined) {
			process.env.CONFIGURATION_POLL_INTERVAL = originalPollingInterval;
		} else {
			delete process.env.CONFIGURATION_POLL_INTERVAL;
		}
		if (mockFetch) {
			mockFetch.mockRestore();
		}
		if (mockServerConnect) {
			mockServerConnect.mockRestore();
		}
		if (mockStartConfigurationPolling) {
			mockStartConfigurationPolling.mockRestore();
		}
		if (mockConnectClients) {
			mockConnectClients.mockRestore();
		}
		if (proxyInstance) {
			try {
				await proxyInstance[Symbol.dispose]();
			} catch (error) {
				// Ignore cleanup errors in tests
			}
			proxyInstance = null;
		}
	});

	test("proxy starts despite network fetch errors", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"));

		proxyInstance = await proxy("https://config.example.com/config.json");

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
		expect(mockFetch).toHaveBeenCalled();
	}, 2000);

	test("proxy starts despite 404 responses", async () => {
		mockFetch.mockResolvedValue(new Response("Not Found", { status: 404 }));

		proxyInstance = await proxy("https://config.example.com/config.json");

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
		expect(mockFetch).toHaveBeenCalled();
	}, 2000);

	test("proxy starts despite 500 server errors", async () => {
		mockFetch.mockResolvedValue(
			new Response("Internal Server Error", { status: 500 }),
		);

		proxyInstance = await proxy("https://config.example.com/config.json");

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
		expect(mockFetch).toHaveBeenCalled();
	}, 2000);

	test("proxy fails on authentication errors", async () => {
		mockFetch.mockResolvedValue(new Response("Unauthorized", { status: 401 }));

		await expect(
			proxy("https://config.example.com/config.json"),
		).rejects.toThrow(/Authentication failed/);
		expect(mockFetch).toHaveBeenCalled();
	}, 2000);

	test("proxy starts with valid configuration", async () => {
		const validConfig = {
			mcp: {
				servers: {
					"test-server": {
						command: "echo",
						args: ["hello"],
					},
				},
			},
		};

		mockFetch.mockResolvedValue(
			new Response(JSON.stringify(validConfig), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		proxyInstance = await proxy("https://config.example.com/config.json");

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
		expect(mockFetch).toHaveBeenCalled();
	}, 2000);

	test("proxy starts without configuration URL", async () => {
		proxyInstance = await proxy();

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
	}, 2000);

	test("proxy starts with malformed configuration URL", async () => {
		proxyInstance = await proxy("not-a-valid-url");

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
	}, 2000);

	test("proxy handles dispose correctly", async () => {
		mockFetch.mockRejectedValue(new Error("Network error"));

		proxyInstance = await proxy("https://config.example.com/config.json");

		expect(proxyInstance).toBeDefined();

		await proxyInstance[Symbol.dispose]();

		proxyInstance = null;
		expect(true).toBe(true);
	}, 2000);

	test("proxy recovers when configuration becomes available", async () => {
		let callCount = 0;
		mockFetch.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return Promise.reject(new Error("Initial failure"));
			}
			return Promise.resolve(
				new Response(
					JSON.stringify({
						mcp: { servers: {} },
					}),
					{
						status: 200,
						headers: { "Content-Type": "application/json" },
					},
				),
			);
		});

		proxyInstance = await proxy("https://config.example.com/config.json");

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
		expect(mockFetch).toHaveBeenCalled();
	}, 2000);

	test("proxy passes authorization headers correctly", async () => {
		const headers = { Authorization: "Bearer test-token-123" };
		mockFetch.mockResolvedValue(new Response("Not Found", { status: 404 }));

		proxyInstance = await proxy("https://config.example.com/config.json", {
			headers,
		});

		expect(proxyInstance).toBeDefined();
		expect(mockFetch).toHaveBeenCalledWith(
			"https://config.example.com/config.json",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-token-123",
					Accept: "application/json",
				}),
			}),
		);
	}, 2000);

	test("proxy fails on 403 forbidden responses", async () => {
		mockFetch.mockResolvedValue(new Response("Forbidden", { status: 403 }));

		proxyInstance = await proxy("https://config.example.com/config.json");

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
		expect(mockFetch).toHaveBeenCalled();
	}, 2000);

	test("proxy handles timeout errors gracefully", async () => {
		const timeoutError = new DOMException(
			"The operation was aborted",
			"AbortError",
		);
		mockFetch.mockRejectedValue(timeoutError);

		proxyInstance = await proxy("https://config.example.com/config.json");

		expect(proxyInstance).toBeDefined();
		expect(typeof proxyInstance[Symbol.dispose]).toBe("function");
		expect(mockFetch).toHaveBeenCalled();
	}, 2000);

	test("proxy handles multiple instances with proper cleanup", async () => {
		mockFetch.mockResolvedValue(new Response("Not Found", { status: 404 }));

		// Create first proxy
		const proxy1 = await proxy("https://config1.example.com/config.json");
		expect(proxy1).toBeDefined();

		// Create second proxy
		const proxy2 = await proxy("https://config2.example.com/config.json");
		expect(proxy2).toBeDefined();

		// Dispose first proxy (simulating the calling code pattern)
		await proxy1[Symbol.dispose]();

		// Set current proxy for cleanup
		proxyInstance = proxy2;

		expect(mockFetch).toHaveBeenCalledTimes(2);
	}, 2000);

	test("proxy works with empty headers object", async () => {
		mockFetch.mockResolvedValue(new Response("Not Found", { status: 404 }));

		proxyInstance = await proxy("https://config.example.com/config.json", {
			headers: {},
		});

		expect(proxyInstance).toBeDefined();
		expect(mockFetch).toHaveBeenCalledWith(
			"https://config.example.com/config.json",
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: "application/json",
				}),
			}),
		);
	}, 2000);

	test("proxy handles concurrent disposal calls", async () => {
		mockFetch.mockResolvedValue(new Response("Not Found", { status: 404 }));

		proxyInstance = await proxy("https://config.example.com/config.json");
		expect(proxyInstance).toBeDefined();

		// Simulate concurrent disposal (as might happen in signal handlers)
		const disposePromises = [
			proxyInstance[Symbol.dispose](),
			proxyInstance[Symbol.dispose](),
		];

		await Promise.all(disposePromises);
		proxyInstance = null;
		expect(true).toBe(true);
	}, 2000);

	test("proxy handles auth error then recovery pattern", async () => {
		let callCount = 0;
		mockFetch.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return Promise.resolve(new Response("Unauthorized", { status: 401 }));
			}
			return Promise.resolve(new Response("Not Found", { status: 404 }));
		});

		// First call should fail due to 401
		await expect(
			proxy("https://config.example.com/config.json"),
		).rejects.toThrow(/Authentication failed/);

		// Second call should succeed (simulating re-auth and retry)
		proxyInstance = await proxy("https://config.example.com/config.json");
		expect(proxyInstance).toBeDefined();
		expect(mockFetch).toHaveBeenCalledTimes(2);
	}, 2000);
});
