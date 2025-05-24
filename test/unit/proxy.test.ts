import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as cleanupModule from "../../src/cleanup";
import * as clientsModule from "../../src/clients";
import * as configModule from "../../src/config";
import * as handlersModule from "../../src/handlers";
import * as loggerModule from "../../src/logger";
import { proxy, server } from "../../src/proxy";

describe("proxy", () => {
	let mockCleanup: ReturnType<typeof spyOn>;
	let mockConfiguration: ReturnType<typeof spyOn>;
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
		mockConfiguration = spyOn(configModule, "configuration").mockImplementation(
			async function* () {
				yield defaultConfig;
			}
		);
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
		mockConfiguration.mockRestore();
		mockConnectClients.mockRestore();
		mockSetRequestHandlers.mockRestore();
		mockServerConnect.mockRestore();
		mockServerClose.mockRestore();
		mockLoggerInfo.mockRestore();
	});

	test("successfully initializes the proxy server", async () => {
		// Act
		const result = await proxy();

		// Give the async generator time to initialize
		await new Promise(resolve => setTimeout(resolve, 0));

		// Assert
		expect(mockConfiguration).toHaveBeenCalledTimes(1);
		expect(mockSetRequestHandlers).toHaveBeenCalledWith(server);
		expect(mockConnectClients).toHaveBeenCalledWith(defaultConfig);
		expect(mockServerConnect).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("MCP Proxy Server starting");
		expect(typeof result[Symbol.dispose]).toBe("function");
	});

	test("accepts configurationUrl parameter", async () => {
		// Arrange
		const customConfigUrl = "https://custom-config.example.com";

		// Act
		await proxy(customConfigUrl);

		// Assert
		expect(mockConfiguration).toHaveBeenCalledWith(
			customConfigUrl,
			undefined,
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
		expect(mockConfiguration).toHaveBeenCalledWith(
			customConfigUrl,
			{ headers: customHeaders },
		);
	});

	describe("error handling", () => {
		test("handles configuration generator error", async () => {
			// Arrange
			mockConfiguration.mockImplementation(async function* () {
				throw new Error("Configuration error");
			});

			// Act & Assert
			return expect(proxy()).rejects.toThrow(
				/Failed to start MCP Proxy Server/,
			);
		});

		test("handles connectClients error", async () => {
			// Arrange
			mockConnectClients.mockRejectedValue(new Error("Connect error"));

			// Act & Assert
			return expect(proxy()).rejects.toThrow(
				/Failed to start MCP Proxy Server/,
			);
		});

		test("handles server connect error", async () => {
			// Arrange
			mockServerConnect.mockRejectedValue(new Error("Server connect error"));

			// Act & Assert
			return expect(proxy()).rejects.toThrow(
				/Failed to start MCP Proxy Server/,
			);
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
			return expect(result[Symbol.dispose]()).rejects.toThrow("Server close error");
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

		test("returns a proper disposable with Symbol.dispose", async () => {
			// Act
			const result = await proxy();

			// Assert
			expect(typeof result[Symbol.dispose]).toBe("function");
		});
	});
});