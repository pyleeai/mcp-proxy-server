import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { configuration, areConfigurationsEqual } from "../../src/config";
import { logger } from "../../src/logger";
import { ConfigurationError } from "../../src/errors";

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
		const gen = configuration();
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
		const gen = configuration();
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
		const abortError = new DOMException(
			"The operation was aborted",
			"AbortError",
		);
		fetchSpy.mockImplementation(() => Promise.reject(abortError));

		// Act
		const gen = configuration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
	});

	test("yields default configuration on network error", async () => {
		// Arrange
		const networkError = new Error("Network error");
		fetchSpy.mockImplementation(() => Promise.reject(networkError));

		// Act
		const gen = configuration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
	});

	test("yields default configuration on HTTP error", async () => {
		// Arrange
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(null, {
					status: 404,
					statusText: "Not Found",
				}),
			),
		);

		// Act
		const gen = configuration();
		const result = await gen.next();

		// Assert
		expect(result.done).toBe(false);
		expect(result.value).toEqual(defaultConfiguration);
		expect(loggerWarnSpy).toHaveBeenCalled();
	});

	test("handles JSON parsing failure", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
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
		const gen = configuration();
		const result = await gen.next();

		// Assert - generator terminates early on parsing failure
		expect(result.done).toBe(true);
	});

	test("handles invalid configuration", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
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
		const gen = configuration();
		const result = await gen.next();

		// Assert - generator terminates early on invalid config
		expect(result.done).toBe(true);
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
		const gen = configuration();
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
		const gen = configuration(customUrl);
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
		const gen = configuration(mockConfigUrl, { headers: customHeaders });
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
		const gen = configuration(mockConfigUrl, { headers: customHeaders });
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
		const gen = configuration();
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
		const gen = configuration();
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
		const gen = configuration();
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
						env: { NODE_ENV: "production" },
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
						env: { NODE_ENV: "development" },
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
