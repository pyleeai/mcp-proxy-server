import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import * as clientsModule from "../../src/clients";
import {
	areConfigurationsEqual,
	generateConfiguration,
	initializeConfiguration,
	startConfigurationPolling,
} from "../../src/config";
import { AuthenticationError, ConfigurationError } from "../../src/errors";
import { logger } from "../../src/logger";

const ENV_MODULE = "../../src/env";
let mockConfigUrl = "https://example.com/config";
let mockPollInterval = 0;

mock.module(ENV_MODULE, () => ({
	CONFIGURATION_URL: mockConfigUrl,
	CONFIGURATION_POLL_INTERVAL: mockPollInterval,
}));

describe("configuration", () => {
	let originalFetch: typeof fetch;
	let fetchSpy: ReturnType<typeof spyOn>;
	let loggerDebugSpy: ReturnType<typeof spyOn>;
	let loggerWarnSpy: ReturnType<typeof spyOn>;
	let loggerInfoSpy: ReturnType<typeof spyOn>;
	let loggerErrorSpy: ReturnType<typeof spyOn>;

	const defaultConfiguration = {
		mcp: {
			servers: {},
		},
	};

	const validConfiguration = {
		mcp: {
			servers: {
				server1: {
					command: "node",
					args: ["server1.js"],
				},
			},
		},
	};

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		fetchSpy = spyOn(globalThis, "fetch");
		loggerDebugSpy = spyOn(logger, "debug");
		loggerWarnSpy = spyOn(logger, "warn");
		loggerInfoSpy = spyOn(logger, "info");
		loggerErrorSpy = spyOn(logger, "error");
		mockConfigUrl = "https://example.com/config";
		mockPollInterval = 0;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		fetchSpy.mockRestore();
		loggerDebugSpy.mockRestore();
		loggerWarnSpy.mockRestore();
		loggerInfoSpy.mockRestore();
		loggerErrorSpy.mockRestore();
	});

	test("yields default configuration when CONFIGURATION_URL is not set", async () => {
		// Arrange
		mockConfigUrl = "";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"No configuration URL found, using default empty configuration",
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("yields default configuration when CONFIGURATION_URL is not a valid URL", async () => {
		// Arrange
		mockConfigUrl = "not-a-valid-url";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockClear();

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"The configuration URL is not valid, using default empty configuration",
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("yields default configuration on timeout error", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		const abortError = new DOMException(
			"The operation was aborted",
			"AbortError",
		);
		fetchSpy.mockImplementation(() => Promise.reject(abortError));

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
		const warnCall = loggerWarnSpy.mock.calls[0];
		expect(warnCall[0]).toContain("Timeout fetching configuration");
		expect(warnCall[1]).toBe(abortError);
	});

	test("yields default configuration on non-timeout fetch error", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		const networkError = new Error("Network connection failed");
		fetchSpy.mockImplementation(() => Promise.reject(networkError));

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
		const warnCall = loggerWarnSpy.mock.calls[0];
		expect(warnCall[0]).toContain("Network error fetching configuration");
	});

	test("yields default configuration on network error", async () => {
		// Arrange
		const networkError = new Error("Network error");
		fetchSpy.mockImplementation(() => Promise.reject(networkError));

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
	});

	test("throws AuthenticationError on 401 HTTP error", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {
					status: 401,
					statusText: "Unauthorized",
				}),
			),
		);

		// Act & Assert
		const gen = generateConfiguration();
		await expect(gen.next()).rejects.toThrow(AuthenticationError);
	});

	test("yields default configuration on 404 HTTP error", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {
					status: 404,
					statusText: "Not Found",
				}),
			),
		);

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
		const warnCall = loggerWarnSpy.mock.calls[0];
		expect(warnCall[0]).toContain("Error fetching configuration");
		expect(warnCall[0]).toContain("404");
		expect(warnCall[0]).toContain("Not Found");
	});

	test("yields default configuration on 500 HTTP error", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {
					status: 500,
					statusText: "Internal Server Error",
				}),
			),
		);

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
		const warnCall = loggerWarnSpy.mock.calls[0];
		expect(warnCall[0]).toContain("Error fetching configuration");
		expect(warnCall[0]).toContain("500");
		expect(warnCall[0]).toContain("Internal Server Error");
	});

	test("yields default configuration on 403 HTTP error", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {
					status: 403,
					statusText: "Forbidden",
				}),
			),
		);

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
		const warnCall = loggerWarnSpy.mock.calls[0];
		expect(warnCall[0]).toContain("Error fetching configuration");
		expect(warnCall[0]).toContain("403");
		expect(warnCall[0]).toContain("Forbidden");
	});

	test("handles JSON parsing failure", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mockPollInterval = 0;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response("{invalid json syntax", {
					status: 200,
				}),
			),
		);

		// Act
		const gen = generateConfiguration();
		const result1 = await gen.next();
		const result2 = await gen.next();

		// Assert
		expect(result1.done).toBe(true);
		expect(result2.done).toBe(true);
		expect(loggerErrorSpy).toHaveBeenCalledWith("Error fetching configuration");
	});

	test("handles invalid configuration", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mockPollInterval = 0;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify({ someOtherField: "value" }), {
					status: 200,
				}),
			),
		);

		// Act
		const gen = generateConfiguration();
		const result1 = await gen.next();
		const result2 = await gen.next();

		// Assert
		expect(result1.done).toBe(true);
		expect(result2.done).toBe(true);
		expect(loggerErrorSpy).toHaveBeenCalledWith("Error fetching configuration");
	});

	test("successfully yields configuration", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(validConfiguration), {
					status: 200,
				}),
			),
		);

		// Act
		const gen = generateConfiguration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(validConfiguration);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Successfully loaded configuration from https://example.com/config",
		);
	});

	test("uses provided configurationUrl parameter instead of environment variable", async () => {
		// Arrange
		const customUrl = "https://custom.example.com/config";
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(validConfiguration), {
					status: 200,
				}),
			),
		);

		// Act
		const gen = generateConfiguration(customUrl);
		await gen.next();

		// Assert
		expect(fetchSpy).toHaveBeenCalledWith(
			customUrl,
			expect.objectContaining({
				method: "GET",
				headers: expect.objectContaining({
					Accept: "application/json",
				}),
			}),
		);
	});

	test("uses provided headers and merges Accept: application/json", async () => {
		// Arrange
		const customHeaders = {
			Authorization: "Bearer token",
			"Content-Type": "application/xml",
		};
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(validConfiguration), {
					status: 200,
				}),
			),
		);

		// Act
		const gen = generateConfiguration(mockConfigUrl, {
			headers: customHeaders,
		});
		await gen.next();

		// Assert
		expect(fetchSpy).toHaveBeenCalledWith(
			mockConfigUrl,
			expect.objectContaining({
				method: "GET",
				headers: {
					...customHeaders,
					Accept: "application/json",
				},
			}),
		);
	});

	test("Accept: application/json takes precedence over provided Accept header", async () => {
		// Arrange
		const customHeaders = {
			Authorization: "Bearer token",
			Accept: "application/xml",
		};
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(validConfiguration), {
					status: 200,
				}),
			),
		);

		// Act
		const gen = generateConfiguration(mockConfigUrl, {
			headers: customHeaders,
		});
		await gen.next();

		// Assert
		expect(fetchSpy).toHaveBeenCalledWith(
			mockConfigUrl,
			expect.objectContaining({
				method: "GET",
				headers: {
					Authorization: "Bearer token",
					Accept: "application/json",
				},
			}),
		);
	});

	test("stops after initial configuration when polling is disabled", async () => {
		// Arrange
		mockPollInterval = 0;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(validConfiguration), {
					status: 200,
				}),
			),
		);

		// Act
		const gen = generateConfiguration();
		const result1 = await gen.next();
		const result2 = await gen.next();

		// Assert
		expect(result1.done).toBe(false);
		expect(result1.value).toEqual(validConfiguration);
		expect(result2.done).toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	test("continues polling when poll interval is set", async () => {
		// Arrange
		mockPollInterval = 100;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));

		const updatedConfiguration = {
			mcp: {
				servers: {
					server2: {
						command: "node",
						args: ["server2.js"],
					},
				},
			},
		};

		fetchSpy
			.mockImplementationOnce(() =>
				Promise.resolve(
					new Response(JSON.stringify(validConfiguration), {
						status: 200,
					}),
				),
			)
			.mockImplementationOnce(() =>
				Promise.resolve(
					new Response(JSON.stringify(updatedConfiguration), {
						status: 200,
					}),
				),
			);

		// Act
		const gen = generateConfiguration();
		const result1 = await gen.next();

		// Wait for polling interval plus some buffer
		await new Promise((resolve) => setTimeout(resolve, 150));
		const result2 = await gen.next();

		// Assert
		expect(result1.done).toBe(false);
		expect(result1.value).toEqual(validConfiguration);
		expect(result2.done).toBe(false);
		expect(result2.value).toEqual(updatedConfiguration);
		expect(loggerInfoSpy).toHaveBeenCalledWith("Configuration changed");
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	test("handles polling errors gracefully", async () => {
		// Arrange
		mockPollInterval = 100;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));

		fetchSpy
			.mockImplementationOnce(() =>
				Promise.resolve(
					new Response(JSON.stringify(validConfiguration), {
						status: 200,
					}),
				),
			)
			.mockImplementationOnce(() =>
				Promise.reject(new Error("Network error during polling")),
			);

		// Act
		const gen = generateConfiguration();
		const result1 = await gen.next();

		// Wait for polling interval
		await new Promise((resolve) => setTimeout(resolve, 150));

		// Assert - first configuration should be yielded successfully
		expect(result1.done).toBe(false);
		expect(result1.value).toEqual(validConfiguration);
		// Polling errors are handled gracefully without terminating the generator
	});
});

describe("areConfigurationsEqual", () => {
	test("returns true for identical configurations", () => {
		const config1 = { mcp: { servers: { test: { command: "test" } } } };
		const config2 = { mcp: { servers: { test: { command: "test" } } } };

		expect(areConfigurationsEqual(config1, config2)).toBe(true);
	});

	test("returns false for different configurations", () => {
		const config1 = { mcp: { servers: { test1: { command: "test1" } } } };
		const config2 = { mcp: { servers: { test2: { command: "test2" } } } };

		expect(areConfigurationsEqual(config1, config2)).toBe(false);
	});

	test("returns true for empty configurations", () => {
		const config1 = { mcp: { servers: {} } };
		const config2 = { mcp: { servers: {} } };

		expect(areConfigurationsEqual(config1, config2)).toBe(true);
	});

	test("returns false when one configuration is empty and the other is not", () => {
		const config1 = { mcp: { servers: {} } };
		const config2 = { mcp: { servers: { test: { command: "test" } } } };

		expect(areConfigurationsEqual(config1, config2)).toBe(false);
	});

	test("handles nested properties correctly", () => {
		const config1 = {
			mcp: {
				servers: {
					test: {
						command: "node",
						args: ["script.js"],
						env: ["NODE_ENV=production"],
					},
				},
			},
		};
		const config2 = {
			mcp: {
				servers: {
					test: {
						command: "node",
						args: ["script.js"],
						env: ["NODE_ENV=development"],
					},
				},
			},
		};

		expect(areConfigurationsEqual(config1, config2)).toBe(false);
	});

	test("is sensitive to property order in arrays", () => {
		const config1 = {
			mcp: { servers: { test: { args: ["arg1", "arg2"] } } },
		};
		const config2 = {
			mcp: { servers: { test: { args: ["arg2", "arg1"] } } },
		};

		expect(areConfigurationsEqual(config1, config2)).toBe(false);
	});
});

describe("startConfigurationPolling", () => {
	let mockConnectClients: ReturnType<typeof spyOn>;
	let loggerInfoSpy: ReturnType<typeof spyOn>;
	let loggerErrorSpy: ReturnType<typeof spyOn>;

	const defaultConfig = { mcp: { servers: {} } };

	beforeEach(() => {
		mockConnectClients = spyOn(
			clientsModule,
			"connectClients",
		).mockImplementation(async () => {});
		loggerInfoSpy = spyOn(logger, "info");
		loggerErrorSpy = spyOn(logger, "error");
	});

	afterEach(() => {
		mockConnectClients.mockRestore();
		loggerInfoSpy.mockRestore();
		loggerErrorSpy.mockRestore();
	});

	test("handles configuration changes and reconnects clients", async () => {
		// Arrange
		const config1 = { mcp: { servers: { server1: {} } } };
		const config2 = { mcp: { servers: { server2: {} } } };
		const abortController = new AbortController();

		async function* mockConfigGen() {
			yield config1;
			yield config2;
		}

		// Act
		const pollingPromise = startConfigurationPolling(
			mockConfigGen(),
			abortController,
		);

		// Give time for polling to process
		await new Promise((resolve) => setTimeout(resolve, 10));
		abortController.abort();
		await pollingPromise;

		// Assert
		expect(mockConnectClients).toHaveBeenCalledWith(config1);
		expect(mockConnectClients).toHaveBeenCalledWith(config2);
		expect(mockConnectClients).toHaveBeenCalledTimes(2);
		expect(loggerInfoSpy).toHaveBeenCalledWith(
			"Configuration changed, reconnecting clients",
		);
	});

	test("stops polling when aborted", async () => {
		// Arrange
		const abortController = new AbortController();
		let generatorRunning = true;

		async function* mockConfigGen() {
			yield defaultConfig;
			while (generatorRunning) {
				await new Promise((resolve) => setTimeout(resolve, 5));
				yield defaultConfig;
			}
		}

		// Act
		const pollingPromise = startConfigurationPolling(
			mockConfigGen(),
			abortController,
		);

		// Give time for polling to start
		await new Promise((resolve) => setTimeout(resolve, 10));

		abortController.abort();
		generatorRunning = false;
		await pollingPromise;

		// Assert
		expect(mockConnectClients).toHaveBeenCalled();
	});

	test("logs errors when not aborted", async () => {
		// Arrange
		const abortController = new AbortController();

		async function* mockConfigGen() {
			yield defaultConfig;
			throw new Error("Polling error");
		}

		// Act
		await startConfigurationPolling(mockConfigGen(), abortController);

		// Assert
		expect(loggerErrorSpy).toHaveBeenCalledWith(
			"Error in configuration polling",
			expect.any(Error),
		);
	});

	test("does not log errors when aborted", async () => {
		// Arrange
		const abortController = new AbortController();
		abortController.abort();

		async function* mockConfigGen() {
			yield defaultConfig;
			throw new Error("Polling error");
		}

		// Act
		await startConfigurationPolling(mockConfigGen(), abortController);

		// Assert
		expect(loggerErrorSpy).not.toHaveBeenCalled();
	});

	test("breaks loop when abort signal is triggered", async () => {
		// Arrange
		const abortController = new AbortController();
		let yieldCount = 0;

		async function* mockConfigGen() {
			while (true) {
				yieldCount++;
				yield defaultConfig;
				if (yieldCount === 2) {
					abortController.abort();
				}
			}
		}

		// Act
		await startConfigurationPolling(mockConfigGen(), abortController);

		// Assert
		expect(yieldCount).toBe(3);
		expect(mockConnectClients).toHaveBeenCalledTimes(2);
	});

	test("re-throws AuthenticationError during polling", async () => {
		// Arrange
		const abortController = new AbortController();
		const authError = new AuthenticationError(
			"Authentication failed during polling",
		);

		async function* mockConfigGen() {
			yield defaultConfig;
			throw authError;
		}

		// Act & Assert
		await expect(
			startConfigurationPolling(mockConfigGen(), abortController),
		).rejects.toThrow(AuthenticationError);

		// Verify no error logging occurred for AuthenticationError
		expect(loggerErrorSpy).not.toHaveBeenCalled();
	});
});

describe("initializeConfiguration", () => {
	let fetchSpy: ReturnType<typeof spyOn>;
	let loggerErrorSpy: ReturnType<typeof spyOn>;
	let loggerInfoSpy: ReturnType<typeof spyOn>;
	let mockConnectClients: ReturnType<typeof spyOn>;

	beforeEach(() => {
		fetchSpy = spyOn(global, "fetch");
		loggerErrorSpy = spyOn(logger, "error").mockImplementation(() => "");
		loggerInfoSpy = spyOn(logger, "info").mockImplementation(() => "");
		mockConnectClients = spyOn(
			clientsModule,
			"connectClients",
		).mockImplementation(async () => {});
	});

	afterEach(() => {
		fetchSpy.mockRestore();
		loggerErrorSpy.mockRestore();
		loggerInfoSpy.mockRestore();
		mockConnectClients.mockRestore();
	});

	test("returns initial config when available", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mockPollInterval = 0;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));

		const testConfig = { mcp: { servers: { test: {} } } };
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(testConfig), {
					status: 200,
				}),
			),
		);

		const abortController = new AbortController();

		// Act
		const result = await initializeConfiguration(
			undefined,
			undefined,
			abortController,
		);

		// Assert
		expect(result).toEqual(testConfig);
	});

	test("returns undefined config when not available", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mockPollInterval = 0;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));

		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response("{invalid json syntax", {
					status: 200,
				}),
			),
		);

		const abortController = new AbortController();

		// Act
		const result = await initializeConfiguration(
			undefined,
			undefined,
			abortController,
		);

		// Assert
		expect(result).toBeUndefined();
	});

	test("returns config when no abortController provided", async () => {
		// Arrange
		mockConfigUrl = "";
		mockPollInterval = 0;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));

		// Act
		const result = await initializeConfiguration();

		// Assert
		expect(result).toBeDefined();
	});

	test("passes through AuthenticationError", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mockPollInterval = 0;
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
			CONFIGURATION_POLL_INTERVAL: mockPollInterval,
		}));

		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response("Unauthorized", {
					status: 401,
					statusText: "Unauthorized",
				}),
			),
		);

		const abortController = new AbortController();

		// Act & Assert
		await expect(
			initializeConfiguration(undefined, undefined, abortController),
		).rejects.toThrow(AuthenticationError);
	});
});
