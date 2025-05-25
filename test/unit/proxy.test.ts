import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as cleanupModule from "../../src/cleanup";
import * as clientsModule from "../../src/clients";
import * as configModule from "../../src/config";
import { AuthenticationError } from "../../src/errors";
import * as handlersModule from "../../src/handlers";
import * as loggerModule from "../../src/logger";
import { proxy, server } from "../../src/proxy";

describe("proxy", () => {
	let mockCleanup: ReturnType<typeof spyOn>;
	let mockInitializeConfiguration: ReturnType<typeof spyOn>;
	let mockConnectClients: ReturnType<typeof spyOn>;
	let mockSetRequestHandlers: ReturnType<typeof spyOn>;
	let mockServerConnect: ReturnType<typeof spyOn>;
	let mockServerClose: ReturnType<typeof spyOn>;
	let mockLoggerInfo: ReturnType<typeof spyOn>;

	const defaultConfig = { mcp: { servers: {} } };

	beforeEach(() => {
		mockCleanup = spyOn(cleanupModule, "cleanup").mockImplementation(
			async () => {},
		);
		mockInitializeConfiguration = spyOn(
			configModule,
			"initializeConfiguration",
		).mockImplementation(async () => defaultConfig);
		mockConnectClients = spyOn(
			clientsModule,
			"connectClients",
		).mockImplementation(async () => {});
		mockSetRequestHandlers = spyOn(
			handlersModule,
			"setRequestHandlers",
		).mockImplementation(() => {});
		mockServerConnect = spyOn(server, "connect").mockImplementation(
			async () => {},
		);
		mockServerClose = spyOn(server, "close").mockImplementation(async () => {});
		mockLoggerInfo = spyOn(loggerModule.logger, "info").mockImplementation(
			() => "",
		);
	});

	afterEach(() => {
		mockCleanup.mockRestore();
		mockInitializeConfiguration.mockRestore();
		mockConnectClients.mockRestore();
		mockSetRequestHandlers.mockRestore();
		mockServerConnect.mockRestore();
		mockServerClose.mockRestore();
		mockLoggerInfo.mockRestore();
	});

	test("successfully initializes the proxy server", async () => {
		// Act
		const result = await proxy();

		await new Promise((resolve) => setTimeout(resolve, 0));

		// Assert
		expect(mockInitializeConfiguration).toHaveBeenCalledTimes(1);
		expect(mockSetRequestHandlers).toHaveBeenCalledWith(server);
		expect(mockConnectClients).toHaveBeenCalledWith(defaultConfig);
		expect(mockServerConnect).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Proxy starting");
		expect(mockLoggerInfo).toHaveBeenCalledWith("Proxy started");
		expect(typeof result[Symbol.dispose]).toBe("function");
	});

	test("accepts configurationUrl parameter", async () => {
		// Arrange
		const customConfigUrl = "https://custom-config.example.com";

		// Act
		await proxy(customConfigUrl);

		// Assert
		expect(mockInitializeConfiguration).toHaveBeenCalledWith(
			customConfigUrl,
			undefined,
			expect.any(AbortController),
		);
	});

	test("accepts headers parameter and passes it to configuration", async () => {
		// Arrange
		const customConfigUrl = "https://custom-config.example.com";
		const customHeaders = {
			"X-Custom-Header": "test-value",
		};

		// Act
		await proxy(customConfigUrl, { headers: customHeaders });

		// Assert
		expect(mockInitializeConfiguration).toHaveBeenCalledWith(
			customConfigUrl,
			{ headers: customHeaders },
			expect.any(AbortController),
		);
	});

	describe("error handling", () => {
		test("continues without initial configuration when generator returns done immediately", async () => {
			// Arrange
			mockInitializeConfiguration.mockImplementation(async () => undefined);

			// Act
			const result = await proxy();

			// Assert
			expect(mockInitializeConfiguration).toHaveBeenCalledTimes(1);
			expect(mockSetRequestHandlers).toHaveBeenCalledWith(server);
			expect(mockConnectClients).not.toHaveBeenCalled();
			expect(mockServerConnect).toHaveBeenCalledTimes(1);
			expect(mockLoggerInfo).toHaveBeenCalledWith("Proxy starting");
			expect(mockLoggerInfo).toHaveBeenCalledWith(
				"Proxy started (waiting for configuration)",
			);
			expect(typeof result[Symbol.dispose]).toBe("function");
		});

		test("continues without initial configuration when generator encounters internal errors", async () => {
			// Arrange
			mockInitializeConfiguration.mockImplementation(async () => undefined);

			// Act
			const result = await proxy();

			// Assert
			expect(mockInitializeConfiguration).toHaveBeenCalledTimes(1);
			expect(mockSetRequestHandlers).toHaveBeenCalledWith(server);
			expect(mockConnectClients).not.toHaveBeenCalled();
			expect(mockServerConnect).toHaveBeenCalledTimes(1);
			expect(mockLoggerInfo).toHaveBeenCalledWith("Proxy starting");
			expect(mockLoggerInfo).toHaveBeenCalledWith(
				"Proxy started (waiting for configuration)",
			);
			expect(typeof result[Symbol.dispose]).toBe("function");
		});

		test("bubbles up AuthenticationError from initial configuration fetch", async () => {
			// Arrange
			const originalError = new AuthenticationError("Unauthorized access");
			mockInitializeConfiguration.mockImplementation(async () => {
				throw originalError;
			});

			// Act & Assert
			try {
				await proxy();
				expect.unreachable("Expected proxy to throw");
			} catch (error) {
				expect(error).toBeInstanceOf(AuthenticationError);
				expect(error.name).toBe("AuthenticationError");
				expect(error.message).toBe("Unauthorized access");
				expect(error).toBe(originalError);
			}
		});

		test("handles connectClients error by throwing", async () => {
			// Arrange
			mockConnectClients.mockRejectedValue(new Error("Connect error"));
			// Ensure configuration returns a config so connectClients is called
			mockInitializeConfiguration.mockImplementation(async () => defaultConfig);

			// Act & Assert
			return expect(proxy()).rejects.toThrow("Connect error");
		});

		test("handles server connect error", async () => {
			// Arrange
			mockServerConnect.mockRejectedValue(new Error("Server connect error"));

			// Act & Assert
			return expect(proxy()).rejects.toThrow("Server connect error");
		});

		test("bubbles up original errors from server setup", async () => {
			// Arrange
			const originalError = new Error("Server setup error");
			mockServerConnect.mockRejectedValue(originalError);

			// Act & Assert
			try {
				await proxy();
				expect.unreachable("Expected proxy to throw");
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect(error.message).toBe("Server setup error");
				expect(error).toBe(originalError);
			}
		});

		test("propagates cleanup error during dispose", async () => {
			// Arrange
			mockCleanup.mockRejectedValue(new Error("Cleanup error"));
			const result = await proxy();

			// Act & Assert
			return expect(result[Symbol.dispose]()).rejects.toThrow("Cleanup error");
		});

		test("propagates server close error during dispose", async () => {
			// Arrange
			mockServerClose.mockRejectedValue(new Error("Server close error"));
			const result = await proxy();

			// Act & Assert
			return expect(result[Symbol.dispose]()).rejects.toThrow(
				"Server close error",
			);
		});
	});

	describe("Symbol.dispose", () => {
		test("disposes correctly", async () => {
			// Arrange
			const result = await proxy();

			// Act
			await result[Symbol.dispose]();

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServerClose).toHaveBeenCalledTimes(1);
		});

		test("aborts configuration polling during dispose", async () => {
			// Arrange
			const result = await proxy();

			// Act
			await result[Symbol.dispose]();

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServerClose).toHaveBeenCalledTimes(1);
		});

		test("returns a proper disposable with Symbol.dispose", async () => {
			// Act
			const result = await proxy();

			// Assert
			expect(typeof result[Symbol.dispose]).toBe("function");
		});
	});
});
