import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
import * as configModule from "../../src/config";
import * as handlersModule from "../../src/handlers";
import { logger } from "../../src/logger";
import { proxy } from "../../src/proxy";

describe("proxy", () => {
	const mockConfig = {
		mcpServers: {
			server1: { url: "http://example.com" },
		},
	};
	let mockTransport: {
		connect: ReturnType<typeof mock>;
		close: ReturnType<typeof mock>;
	};
	let mockServer: {
		connect: ReturnType<typeof mock>;
		close: ReturnType<typeof mock>;
		setRequestHandler: ReturnType<typeof mock>;
	};
	let mockFetchConfiguration: ReturnType<typeof spyOn>;
	let mockSetRequestHandlers: ReturnType<typeof spyOn>;
	let mockConnectClients: ReturnType<typeof spyOn>;
	let mockLoggerInfo: ReturnType<typeof spyOn>;
	let mockLoggerError: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockTransport = {
			connect: mock(() => Promise.resolve()),
			close: mock(() => Promise.resolve()),
		};
		mockServer = {
			connect: mock(() => Promise.resolve()),
			close: mock(() => Promise.resolve()),
			setRequestHandler: mock(() => undefined),
		};
		(
			spyOn({ StdioServerTransport }, "StdioServerTransport") as unknown as {
				mockImplementation: (
					impl: () => InstanceType<typeof StdioServerTransport>,
				) => void;
			}
		).mockImplementation(
			() =>
				mockTransport as unknown as InstanceType<typeof StdioServerTransport>,
		);
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
		mockLoggerInfo = spyOn(logger, "info");
		mockLoggerError = spyOn(logger, "error");
	});

	afterEach(() => {
		mockFetchConfiguration.mockRestore();
		mockSetRequestHandlers.mockRestore();
		mockConnectClients.mockRestore();
		mockLoggerInfo.mockRestore();
		mockLoggerError.mockRestore();
	});

	test("should set up proxy correctly", async () => {
		// Act
		await proxy(mockServer as unknown as Server);

		// Assert
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockSetRequestHandlers).toHaveBeenCalledWith(mockServer);
		expect(mockConnectClients).toHaveBeenCalledWith(mockConfig);
		expect(mockServer.connect).toHaveBeenCalledTimes(1);
		expect(mockServer.connect).toHaveBeenCalledWith(expect.anything());
		expect(mockLoggerInfo).toHaveBeenCalledTimes(2);
	}, 1000);

	test("should handle connectClients error", async () => {
		// Arrange
		const testError = new Error("Failed to connect clients");
		mockConnectClients.mockImplementation(() => Promise.reject(testError));

		// Act & Assert
		expect(proxy(mockServer as unknown as Server)).rejects.toThrow(testError);
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockConnectClients).toHaveBeenCalledWith(mockConfig);
		expect(mockServer.connect).not.toHaveBeenCalled();
	}, 1000);

	test("should handle server connect error", async () => {
		const testError = new Error("Failed to connect server");
		const localMockServer = {
			connect: mock(() => Promise.reject(testError)),
			close: mock(() => Promise.resolve()),
			setRequestHandler: mock(() => undefined),
		};
		const localFetchConfig = spyOn(
			configModule,
			"fetchConfiguration",
		).mockImplementation(() => Promise.resolve(mockConfig));
		const localSetRequestHandlers = spyOn(
			handlersModule,
			"setRequestHandlers",
		).mockImplementation(() => {});
		const localConnectClients = spyOn(
			clientsModule,
			"connectClients",
		).mockImplementation(() => Promise.resolve());

		try {
			// Act
			await proxy(localMockServer as unknown as Server);
			expect(false).toBe(true);
		} catch (error) {
			// Assert
			expect(error).toEqual(testError);
			expect(localFetchConfig).toHaveBeenCalledTimes(1);
			expect(localConnectClients).toHaveBeenCalledWith(mockConfig);
			expect(localMockServer.connect).toHaveBeenCalledTimes(1);
		}

		localFetchConfig.mockRestore();
		localSetRequestHandlers.mockRestore();
		localConnectClients.mockRestore();
	}, 1000);

	test("should handle fetchConfiguration error", async () => {
		// Arrange
		const testError = new Error("Failed to fetch configuration");
		mockFetchConfiguration.mockImplementation(() => Promise.reject(testError));

		// Act & Assert
		expect(proxy(mockServer as unknown as Server)).rejects.toThrow(testError);
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockConnectClients).not.toHaveBeenCalled();
		expect(mockServer.connect).not.toHaveBeenCalled();
	}, 1000);
});
