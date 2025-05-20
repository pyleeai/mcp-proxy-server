import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { fetchConfiguration } from "../../src/config";
import { ConfigurationError } from "../../src/errors";
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

	beforeEach(() => {
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));

		originalFetch = globalThis.fetch;
		fetchSpy = spyOn(globalThis, "fetch");
		loggerDebugSpy = spyOn(logger, "debug");
	});

	test("throws error when CONFIGURATION_URL is not set", () => {
		// Arrange
		mockConfigUrl = "";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));
		fetchSpy.mockClear();

		// Act & Assert
		expect(fetchConfiguration()).rejects.toThrow(ConfigurationError);
		expect(fetchConfiguration()).rejects.toThrow("No configuration URL found");
		expect(loggerDebugSpy).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("throws error when CONFIGURATION_URL is not a valid URL", () => {
		// Arrange
		mockConfigUrl = "not-a-valid-url";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));
		fetchSpy.mockClear();

		// Act & Assert
		expect(fetchConfiguration()).rejects.toThrow(ConfigurationError);
		expect(fetchConfiguration()).rejects.toThrow(
			"The configuration URL is not valid",
		);
		expect(loggerDebugSpy).not.toHaveBeenCalled();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("handles timeout error", () => {
		// Arrange
		const abortError = new DOMException(
			"The operation was aborted",
			"AbortError",
		);
		fetchSpy.mockImplementation(() => Promise.reject(abortError));

		// Act & Assert
		expect(fetchConfiguration()).rejects.toThrow(ConfigurationError);
		expect(fetchConfiguration()).rejects.toThrow(
			"Timeout fetching configuration (exceeded 10s)",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
	});

	test("handles network error", () => {
		// Arrange
		const networkError = new Error("Network error");
		fetchSpy.mockImplementation(() => Promise.reject(networkError));

		// Act & Assert
		expect(fetchConfiguration()).rejects.toThrow(ConfigurationError);
		expect(fetchConfiguration()).rejects.toThrow(
			"Network error fetching configuration",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
	});

	test("handles HTTP error", () => {
		// Arrange
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response("Not Found", {
					status: 404,
					statusText: "Not Found",
				}),
			),
		);

		// Act & Assert
		expect(fetchConfiguration()).rejects.toThrow(ConfigurationError);
		expect(fetchConfiguration()).rejects.toThrow(
			"Error fetching configuration (404 Not Found)",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
	});

	test("handles JSON parsing error", () => {
		// Arrange
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response("Not JSON", {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);

		// Act & Assert
		expect(fetchConfiguration()).rejects.toThrow(ConfigurationError);
		expect(fetchConfiguration()).rejects.toThrow(
			"Failed to parse configuration",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
	});

	test("throws error when configuration is invalid", () => {
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

			// Act & Assert
			expect(fetchConfiguration()).rejects.toThrow(ConfigurationError);
			expect(fetchConfiguration()).rejects.toThrow("Invalid configuration");
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
	});

	afterEach(() => {
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));

		globalThis.fetch = originalFetch;
		fetchSpy.mockRestore();
		loggerDebugSpy.mockRestore();
	});
});
