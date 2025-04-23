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

const VALID_CONFIGURATION = {
	version: "1.0.0",
	models: [{ id: "test-model", name: "Test Model" }],
	mcpServers: {
		server1: {
			url: "https://example.com/server1",
		},
	},
};

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
		expect(fetchConfiguration()).rejects.toThrow(
			"Required environment variable CONFIGURATION_URL is not defined",
		);
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
			"The environment variable CONFIGURATION_URL is not a valid URL",
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

	test("successfully fetches and parses configuration", async () => {
		// Arrange
		mockConfigUrl = "https://example.com/config";
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_URL: mockConfigUrl,
		}));
		fetchSpy.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify(VALID_CONFIGURATION), {
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
		expect(result).toEqual(VALID_CONFIGURATION);
		expect(loggerDebugSpy).toHaveBeenCalledTimes(2);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Fetching configuration from https://example.com/config",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Successfully loaded configuration",
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
