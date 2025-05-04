import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as cleanupModule from "../../src/cleanup";
import * as clientsModule from "../../src/clients";
import * as configModule from "../../src/config";
import * as handlersModule from "../../src/handlers";
import * as loggerModule from "../../src/logger";
import { proxy, server } from "../../src/proxy";

describe("proxy", () => {
	let mockCleanup: ReturnType<typeof spyOn>;
	let mockFetchConfiguration: ReturnType<typeof spyOn>;
	let mockConnectClients: ReturnType<typeof spyOn>;
	let mockSetRequestHandlers: ReturnType<typeof spyOn>;
	let mockServerConnect: ReturnType<typeof spyOn>;
	let mockServerClose: ReturnType<typeof spyOn>;
	let mockLoggerInfo: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockCleanup = spyOn(cleanupModule, "cleanup").mockImplementation(
			async () => {},
		);
		mockFetchConfiguration = spyOn(
			configModule,
			"fetchConfiguration",
		).mockImplementation(async () => ({
			clients: [],
			mcp: { servers: {} },
		}));
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
		mockFetchConfiguration.mockRestore();
		mockConnectClients.mockRestore();
		mockSetRequestHandlers.mockRestore();
		mockServerConnect.mockRestore();
		mockServerClose.mockRestore();
		mockLoggerInfo.mockRestore();
	});

	describe("Symbol.dispose", () => {
		test("disposes correctly", async () => {
			// Arrange
			const proxyInstance = await proxy();

			// Act
			const disposeFunc = proxyInstance[Symbol.dispose]();
			await disposeFunc();

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServerClose).toHaveBeenCalledTimes(1);
		});

		test("returns a proper disposable with Symbol.dispose", async () => {
			// Arrange
			const proxyInstance = await proxy();

			// Act
			const disposeFunction = proxyInstance[Symbol.dispose]();

			// Assert
			expect(typeof disposeFunction).toBe("function");

			// Act
			await disposeFunction();

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServerClose).toHaveBeenCalledTimes(1);
		});
	});

	test("successfully initializes the proxy server", async () => {
		// Act
		await proxy();

		// Assert
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockConnectClients).toHaveBeenCalledTimes(1);
		expect(mockSetRequestHandlers).toHaveBeenCalledTimes(1);
		expect(mockServerConnect).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("MCP Proxy Server started");
	});

	test("accepts configurationUrl parameter", async () => {
		// Arrange
		const customConfigUrl = "https://example.com/config.json";

		// Act
		await proxy(customConfigUrl);

		// Assert
		expect(mockFetchConfiguration).toHaveBeenCalledWith(customConfigUrl);
	});

	describe("error handling", () => {
		test("handles fetchConfiguration error", async () => {
			// Arrange
			const testError = new Error("Failed to fetch configuration");
			mockFetchConfiguration.mockImplementationOnce(() =>
				Promise.reject(testError),
			);

			// Act & Assert
			return expect(proxy()).rejects.toThrow(
				/Failed to start MCP Proxy Server/,
			);
		});

		test("handles connectClients error", async () => {
			// Arrange
			const testError = new Error("Failed to connect clients");
			mockConnectClients.mockImplementationOnce(() =>
				Promise.reject(testError),
			);

			// Act & Assert
			return expect(proxy()).rejects.toThrow(
				/Failed to start MCP Proxy Server/,
			);
		});

		test("handles server connect error", async () => {
			// Arrange
			const testError = new Error("Failed to connect server");
			mockServerConnect.mockImplementationOnce(() => Promise.reject(testError));

			// Act & Assert
			return expect(proxy()).rejects.toThrow(
				/Failed to start MCP Proxy Server/,
			);
		});

		test("propagates cleanup error during dispose", async () => {
			// Arrange
			const testError = new Error("Cleanup error");
			mockCleanup.mockImplementationOnce(() => Promise.reject(testError));
			const proxyInstance = await proxy();
			const disposeFunc = proxyInstance[Symbol.dispose]();

			// Act & Assert
			expect(disposeFunc()).rejects.toThrow("Cleanup error");

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServerClose).toHaveBeenCalledTimes(0);
		});

		test("propagates server close error during dispose", async () => {
			// Arrange
			const testError = new Error("Server close error");
			mockServerClose.mockImplementationOnce(() => Promise.reject(testError));
			const proxyInstance = await proxy();
			const disposeFunc = proxyInstance[Symbol.dispose]();

			// Act & Assert
			expect(disposeFunc()).rejects.toThrow("Server close error");

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServerClose).toHaveBeenCalledTimes(1);
		});
	});
});
