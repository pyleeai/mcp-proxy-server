import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { fetchConfiguration, areConfigurationsEqual } from "../../src/config";
import { logger } from "../../src/logger";

const ENV_MODULE = "../../src/env";
let mockConfigUrl = "https://example.com/config";

mock.module(ENV_MODULE, () => ({
	CONFIGURATION_URL: mockConfigUrl,
}));

describe("fetchConfiguration", () => {
	let originalFetch: typeof fetch;
	let fetchSpy: ReturnType<typeof spyOn>;
	let loggerDebugSpy: ReturnType<typeof spyOn>;
	let loggerWarnSpy: ReturnType<typeof spyOn>;

	const defaultConfiguration = {
		mcp: {
			servers: {},
		},
	};

	beforeEach(() => {
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));

		originalFetch = globalThis.fetch;
		fetchSpy = spyOn(globalThis, "fetch");
		loggerDebugSpy = spyOn(logger, "debug");
		loggerWarnSpy = spyOn(logger, "warn");

		// Clear all spy call history

		loggerDebugSpy.mockClear();
		loggerWarnSpy.mockClear();
	});

	test("returns default configuration when CONFIGURATION_URL is not set", async () => {
		// Arrange
		mockConfigUrl = "";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));

		// Act
		const result = await fetchConfiguration();

		// Assert
		expect(result).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"No configuration URL found, using default empty configuration",
		);
		expect(loggerDebugSpy).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("returns default configuration when CONFIGURATION_URL is not a valid URL", async () => {
		// Arrange
		mockConfigUrl = "not-a-valid-url";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));
		fetchSpy.mockClear();

		// Act
		const result = await fetchConfiguration();

		// Assert
		expect(result).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"The configuration URL is not valid, using default empty configuration",
		);
		expect(loggerDebugSpy).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("returns default configuration on timeout error", async () => {
		// Arrange
		const abortError = new DOMException(
			"The operation was aborted",
			"AbortError",
		);
		fetchSpy.mockImplementation(() => Promise.reject(abortError));

		// Act
		const result = await fetchConfiguration();

		// Assert
		expect(result).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"Timeout fetching configuration (exceeded 10s), using default empty configuration",
			abortError,
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
	});

	test("returns default configuration on network error", async () => {
		// Arrange
		const networkError = new Error("Network error");
		fetchSpy.mockImplementation(() => Promise.reject(networkError));

		// Act
		const result = await fetchConfiguration();

		// Assert
		expect(result).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"Network error fetching configuration, using default empty configuration",
			networkError,
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
	});

	test("returns default configuration on HTTP error", async () => {
		// Arrange
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response("Not Found", {
					status: 404,
					statusText: "Not Found",
				}),
			),
		);

		// Act
		const result = await fetchConfiguration();

		// Assert
		expect(result).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"Error fetching configuration (404 Not Found), using default empty configuration",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
	});

	test("returns default configuration on JSON parsing error", async () => {
		// Arrange
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response("Not JSON", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		// Act
		const result = await fetchConfiguration();

		// Assert
		expect(result).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"Failed to parse configuration, using default empty configuration",
			expect.any(Error),
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
	});

	test("returns default configuration when configuration is invalid", async () => {
		// Arrange
		const invalidConfigurations = [
			{},
			{ mcp: {} },
			{ mcp: { servers: null } },
			{ version: "1.0.0", models: [] },
		];

		for (const invalidConfig of invalidConfigurations) {
			fetchSpy.mockImplementation(() =>
				Promise.resolve(
					new Response(JSON.stringify(invalidConfig), {
						status: 200,
						headers: { "Content-Type": "application/json" },
					}),
				),
			);

			// Act
			const result = await fetchConfiguration();

			// Assert
			expect(result).toEqual(defaultConfiguration);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				"Invalid configuration structure, using default empty configuration",
			);
		}
	});

	test("successfully fetches and parses configuration", async () => {
		// Arrange
		const configuration = {
			version: "1.0.0",
			models: [{ id: "test-model", name: "Test Model" }],
			mcp: {
				servers: {
					server1: {
						url: "https://example.com/server1",
					},
				},
			},
		};
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(configuration), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		// Act
		const result = await fetchConfiguration();

		// Assert
		expect(fetchSpy).toHaveBeenCalledWith("https://example.com/config", {
			method: "GET",
			headers: { Accept: "application/json" },
			signal: expect.any(AbortSignal),
		});
		expect(result).toEqual(configuration);
		expect(loggerDebugSpy).toHaveBeenCalledTimes(2);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Successfully loaded configuration from https://example.com/config",
		);
		expect(loggerWarnSpy).not.toHaveBeenCalled();
	});

	test("uses provided configurationUrl parameter instead of environment variable", async () => {
		// Arrange
		const configuration = {
			version: "1.0.0",
			models: [{ id: "test-model", name: "Test Model" }],
			mcp: {
				servers: {
					server1: {
						url: "https://example.com/server1",
					},
				},
			},
		};
		mockConfigUrl = "https://example.com/default-config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));
		const customUrl = "https://example.com/custom-config";
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(configuration), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		// Act
		const result = await fetchConfiguration(customUrl);

		// Assert
		expect(fetchSpy).toHaveBeenCalledWith(customUrl, {
			method: "GET",
			headers: { Accept: "application/json" },
			signal: expect.any(AbortSignal),
		});
		expect(result).toEqual(configuration);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			`Fetching configuration from ${customUrl}`,
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			`Successfully loaded configuration from ${customUrl}`,
		);
		expect(loggerWarnSpy).not.toHaveBeenCalled();
	});

	test("uses provided headers and merges Accept: application/json", async () => {
		// Arrange
		const configuration = {
			mcp: { servers: { server1: { url: "test" } } },
		};
		const customHeaders = { "X-Custom-Header": "TestValue" };
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(configuration), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		// Act
		await fetchConfiguration(mockConfigUrl, customHeaders);

		// Assert
		expect(fetchSpy).toHaveBeenCalledWith(mockConfigUrl, {
			method: "GET",
			headers: {
				...customHeaders,
				Accept: "application/json",
			},
			signal: expect.any(AbortSignal),
		});
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			`Fetching configuration from ${mockConfigUrl}`,
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			`Successfully loaded configuration from ${mockConfigUrl}`,
		);
		expect(loggerWarnSpy).not.toHaveBeenCalled();
	});

	test("hardcoded Accept: application/json takes precedence over provided Accept header", async () => {
		// Arrange
		const configuration = {
			mcp: { servers: { server1: { url: "test" } } },
		};
		const customHeaders = {
			"X-Custom-Header": "TestValue",
			Accept: "application/xml",
		};
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(configuration), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		// Act
		await fetchConfiguration(mockConfigUrl, customHeaders);

		// Assert
		expect(fetchSpy).toHaveBeenCalledWith(mockConfigUrl, {
			method: "GET",
			headers: {
				"X-Custom-Header": "TestValue",
				Accept: "application/json",
			},
			signal: expect.any(AbortSignal),
		});
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			`Fetching configuration from ${mockConfigUrl}`,
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			`Successfully loaded configuration from ${mockConfigUrl}`,
		);
		expect(loggerWarnSpy).not.toHaveBeenCalled();
	});

	afterEach(() => {
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));

		globalThis.fetch = originalFetch;
		fetchSpy.mockRestore();
		loggerDebugSpy.mockRestore();
		loggerWarnSpy.mockRestore();
	});
});

describe("areConfigurationsEqual", () => {
	test("returns true for identical configurations", () => {
		// Arrange
		const config1 = {
			mcp: {
				servers: {
					server1: { url: "https://example.com" },
					server2: { command: "node", args: ["script.js"] },
				},
			},
		};
		const config2 = {
			mcp: {
				servers: {
					server1: { url: "https://example.com" },
					server2: { command: "node", args: ["script.js"] },
				},
			},
		};

		// Act
		const result = areConfigurationsEqual(config1, config2);

		// Assert
		expect(result).toBe(true);
	});

	test("returns false for different configurations", () => {
		// Arrange
		const config1 = {
			mcp: {
				servers: {
					server1: { url: "https://example.com" },
				},
			},
		};
		const config2 = {
			mcp: {
				servers: {
					server1: { url: "https://different.com" },
				},
			},
		};

		// Act
		const result = areConfigurationsEqual(config1, config2);

		// Assert
		expect(result).toBe(false);
	});

	test("returns false for configurations with different server counts", () => {
		// Arrange
		const config1 = {
			mcp: {
				servers: {
					server1: { url: "https://example.com" },
				},
			},
		};
		const config2 = {
			mcp: {
				servers: {
					server1: { url: "https://example.com" },
					server2: { command: "node" },
				},
			},
		};

		// Act
		const result = areConfigurationsEqual(config1, config2);

		// Assert
		expect(result).toBe(false);
	});

	test("returns true for empty configurations", () => {
		// Arrange
		const config1 = { mcp: { servers: {} } };
		const config2 = { mcp: { servers: {} } };

		// Act
		const result = areConfigurationsEqual(config1, config2);

		// Assert
		expect(result).toBe(true);
	});
});
