import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as clientsModule from "../../src/clients";
import * as configModule from "../../src/config";
import { ProxyError } from "../../src/errors";
import * as handlersModule from "../../src/handlers";
import { logger } from "../../src/logger";
import * as proxyModule from "../../src/proxy";

describe("proxy", () => {
	const mockConfig = {
		mcp: {
			servers: { server1: { url: "http://example.com" } },
		},
	};
	let mockFetchConfiguration: ReturnType<typeof spyOn>;
	let mockSetRequestHandlers: ReturnType<typeof spyOn>;
	let mockConnectClients: ReturnType<typeof spyOn>;
	let mockLoggerInfo: ReturnType<typeof spyOn>;
	let mockLoggerError: ReturnType<typeof spyOn>;
	let serverConnectSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockFetchConfiguration = spyOn(
			configModule,
			"fetchConfiguration",
		).mockImplementation(() => Promise.resolve(mockConfig));
		mockSetRequestHandlers = spyOn(
			handlersModule,
			"setRequestHandlers",
		).mockImplementation(() => {});
		mockConnectClients = spyOn(
			clientsModule,
			"connectClients",
		).mockImplementation(() => Promise.resolve());
		mockLoggerInfo = spyOn(logger, "info").mockImplementation(() => "");
		mockLoggerError = spyOn(logger, "error").mockImplementation(() => "");
		const originalServer = proxyModule.server;
		serverConnectSpy = spyOn(originalServer, "connect");
	});

	afterEach(() => {
		mockFetchConfiguration.mockRestore();
		mockSetRequestHandlers.mockRestore();
		mockConnectClients.mockRestore();
		mockLoggerInfo.mockRestore();
		mockLoggerError.mockRestore();
		serverConnectSpy.mockRestore();
	});

	test("should set up proxy correctly", async () => {
		// Act
		await proxyModule.proxy();

		// Assert
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockSetRequestHandlers).toHaveBeenCalledWith(proxyModule.server);
		expect(mockConnectClients).toHaveBeenCalledWith(mockConfig);
		expect(serverConnectSpy).toHaveBeenCalledTimes(1);
		const transportArg = serverConnectSpy.mock.calls[0][0];
		expect(transportArg).toBeInstanceOf(StdioServerTransport);
		expect(mockLoggerInfo).toHaveBeenCalled();
	});

	test("should handle connectClients error", async () => {
		// Arrange
		const testError = new Error("Failed to connect clients");
		const thrownError = new ProxyError(
			"Failed to start MCP Proxy Server: Failed to connect clients",
		);
		mockConnectClients.mockImplementation(() => Promise.reject(testError));

		// Act & Assert
		expect(proxyModule.proxy()).rejects.toThrow(thrownError);

		// Assert
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockConnectClients).toHaveBeenCalledWith(mockConfig);
		expect(serverConnectSpy).not.toHaveBeenCalled();
	});

	test("should handle server connect error", async () => {
		// Arrange
		const testError = new Error("Failed to connect server");
		const thrownError = new ProxyError(
			"Failed to start MCP Proxy Server: Failed to connect server",
		);
		serverConnectSpy.mockImplementation(() => Promise.reject(testError));

		// Act & Assert
		expect(proxyModule.proxy()).rejects.toThrow(thrownError);

		// Assert
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockConnectClients).toHaveBeenCalledWith(mockConfig);
		expect(serverConnectSpy).toHaveBeenCalledTimes(1);
	});

	test("should handle fetchConfiguration error", async () => {
		// Arrange
		const testError = new Error("Failed to fetch configuration");
		const thrownError = new ProxyError(
			"Failed to start MCP Proxy Server: Failed to fetch configuration",
		);
		mockFetchConfiguration.mockImplementation(() => Promise.reject(testError));

		// Act & Assert
		expect(proxyModule.proxy()).rejects.toThrow(thrownError);

		// Assert
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockConnectClients).not.toHaveBeenCalled();
		expect(serverConnectSpy).not.toHaveBeenCalled();
	});
});
