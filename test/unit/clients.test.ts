import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import * as clientModule from "../../src/client";
import { connectClients } from "../../src/clients";
import * as connectModule from "../../src/connect";
import * as dataModule from "../../src/data";
import { logger } from "../../src/logger";
import type {
	ClientState,
	Configuration,
	ServerConfiguration,
} from "../../src/types";

let mockCreateClient: ReturnType<typeof spyOn>;
let mockConnect: ReturnType<typeof spyOn>;
let mockSetClientState: ReturnType<typeof spyOn>;
let mockGetAllClientStates: ReturnType<typeof spyOn>;
let mockClearAllClientStates: ReturnType<typeof spyOn>;
let mockLoggerInfo: ReturnType<typeof spyOn>;
let mockLoggerDebug: ReturnType<typeof spyOn>;
let mockLoggerError: ReturnType<typeof spyOn>;
let mockLoggerWarn: ReturnType<typeof spyOn>;

describe("connectClients", () => {
	const mockClient = { name: "mockClient" } as unknown as Client;
	const mockTransport = {
		close: () => {},
		start: () => Promise.resolve(),
		send: () => Promise.resolve(),
	} as unknown as Transport;

	beforeEach(() => {
		mockCreateClient = spyOn(clientModule, "createClient").mockImplementation(
			() => mockClient,
		);
		mockConnect = spyOn(connectModule, "connect").mockImplementation(() =>
			Promise.resolve(mockTransport),
		);
		mockSetClientState = spyOn(dataModule, "setClientState");
		mockGetAllClientStates = spyOn(
			dataModule,
			"getAllClientStates",
		).mockImplementation(() => []);
		mockClearAllClientStates = spyOn(dataModule, "clearAllClientStates");
		mockLoggerInfo = spyOn(logger, "info");
		mockLoggerDebug = spyOn(logger, "debug");
		mockLoggerError = spyOn(logger, "error").mockImplementation(() => "");
		mockLoggerWarn = spyOn(logger, "warn").mockImplementation(() => "");
	});

	afterEach(() => {
		mockCreateClient.mockRestore();
		mockConnect.mockRestore();
		mockSetClientState.mockRestore();
		mockGetAllClientStates.mockRestore();
		mockClearAllClientStates.mockRestore();
		mockLoggerInfo.mockRestore();
		mockLoggerDebug.mockRestore();
		mockLoggerError.mockRestore();
		mockLoggerWarn.mockRestore();
	});

	test("should handle empty configuration with no servers", async () => {
		// Arrange
		const configuration: Configuration = {
			mcp: {
				servers: {},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockLoggerInfo).toHaveBeenCalledWith("No servers to connect");
		expect(mockCreateClient).not.toHaveBeenCalled();
		expect(mockConnect).not.toHaveBeenCalled();
		expect(mockSetClientState).not.toHaveBeenCalled();
		expect(mockGetAllClientStates).not.toHaveBeenCalled();
		expect(mockClearAllClientStates).not.toHaveBeenCalled();
	});

	test("should process different server types correctly", async () => {
		// Arrange
		const configuration: Configuration = {
			mcp: {
				servers: {
					httpServer: { url: "http://server.example.com" },
					commandServer: { command: "some-command" },
					fullServer: {
						command: "full-command",
						args: ["--verbose"],
						env: ["ENV=production"],
						url: "http://fallback-url.example.com",
					},
				},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connecting to 3 servers");
		expect(mockCreateClient).toHaveBeenCalledTimes(3);
		expect(mockConnect).toHaveBeenCalledTimes(3);
		expect(mockSetClientState).toHaveBeenCalledTimes(3);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connected to 3/3 servers");
		expect(mockGetAllClientStates).not.toHaveBeenCalled();
		expect(mockClearAllClientStates).not.toHaveBeenCalled();
	});

	test("should create clients for each server in the configuration", async () => {
		// Arrange
		const configuration: Configuration = {
			mcp: {
				servers: {
					server1: { url: "http://server1.example.com" },
					server2: { command: "some-command", args: ["--arg1", "--arg2"] },
				},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connecting to 2 servers");
		expect(mockCreateClient).toHaveBeenCalledTimes(2);
		expect(mockConnect).toHaveBeenCalledTimes(2);
		expect(mockSetClientState).toHaveBeenCalledTimes(2);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connected to 2/2 servers");
		expect(mockConnect).toHaveBeenCalledWith(mockClient, {
			url: "http://server1.example.com",
		});
		expect(mockSetClientState).toHaveBeenCalledWith("server1", {
			name: "server1",
			client: mockClient,
			transport: mockTransport,
		});
		expect(mockConnect).toHaveBeenCalledWith(mockClient, {
			command: "some-command",
			args: ["--arg1", "--arg2"],
		});
		expect(mockSetClientState).toHaveBeenCalledWith("server2", {
			name: "server2",
			client: mockClient,
			transport: mockTransport,
		});
		expect(mockGetAllClientStates).not.toHaveBeenCalled();
		expect(mockClearAllClientStates).not.toHaveBeenCalled();
	});

	test("should connect to multiple servers in parallel", async () => {
		// Arrange
		let connectCallCount = 0;
		const connectDelays = [100, 50, 75];

		mockConnect.mockImplementation(() => {
			const delay = connectDelays[connectCallCount++];
			return new Promise((resolve) => {
				setTimeout(() => resolve(mockTransport), delay);
			});
		});

		const configuration: Configuration = {
			mcp: {
				servers: {
					server1: { url: "http://server1.example.com" },
					server2: { url: "http://server2.example.com" },
					server3: { url: "http://server3.example.com" },
				},
			},
		};

		const startTime = Date.now();

		// Act
		await connectClients(configuration);

		const endTime = Date.now();
		const duration = endTime - startTime;

		// Assert - if connections were sequential, it would take 225ms+ (100+50+75)
		// if parallel, it should take around 100ms (max of the delays)
		expect(duration).toBeLessThan(200); // Allow some buffer for test execution
		expect(mockConnect).toHaveBeenCalledTimes(3);
		expect(mockSetClientState).toHaveBeenCalledTimes(3);
	});

	test("should handle individual client connection failures without blocking others", async () => {
		// Arrange
		let connectCallCount = 0;
		mockConnect.mockImplementation(() => {
			connectCallCount++;
			if (connectCallCount === 2) {
				return Promise.reject(new Error("Connection failed for server2"));
			}
			return Promise.resolve(mockTransport);
		});

		mockLoggerWarn.mockClear();

		const configuration: Configuration = {
			mcp: {
				servers: {
					server1: { url: "http://server1.example.com" },
					server2: { url: "http://server2.example.com" },
					server3: { url: "http://server3.example.com" },
				},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockConnect).toHaveBeenCalledTimes(3);
		expect(mockSetClientState).toHaveBeenCalledTimes(2); // Only 2 successful connections
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			"Failed to connect to server server2: Connection failed for server2",
		);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connected to 2/3 servers");
	});

	test("should continue when all client connections fail", async () => {
		// Arrange
		mockConnect.mockImplementation(() => {
			return Promise.reject(new Error("All connections failed"));
		});

		mockLoggerWarn.mockClear();

		const configuration: Configuration = {
			mcp: {
				servers: {
					server1: { url: "http://server1.example.com" },
					server2: { url: "http://server2.example.com" },
				},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockConnect).toHaveBeenCalledTimes(2);
		expect(mockSetClientState).not.toHaveBeenCalled();
		expect(mockLoggerWarn).toHaveBeenCalledTimes(2);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connected to 0/2 servers");
	});

	test("should handle mixed success and failure scenarios gracefully", async () => {
		// Arrange
		let connectCallCount = 0;
		mockConnect.mockImplementation(() => {
			connectCallCount++;
			if (connectCallCount === 1 || connectCallCount === 4) {
				return Promise.reject(
					new Error(`Connection failed for server${connectCallCount}`),
				);
			}
			return Promise.resolve(mockTransport);
		});

		mockLoggerWarn.mockClear();

		const configuration: Configuration = {
			mcp: {
				servers: {
					server1: { url: "http://server1.example.com" },
					server2: { url: "http://server2.example.com" },
					server3: { url: "http://server3.example.com" },
					server4: { url: "http://server4.example.com" },
				},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockConnect).toHaveBeenCalledTimes(4);
		expect(mockSetClientState).toHaveBeenCalledTimes(2); // Only 2 successful connections
		expect(mockLoggerWarn).toHaveBeenCalledTimes(2); // 2 failures
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connected to 2/4 servers");
	});

	test("should handle connect function validation errors", async () => {
		// Arrange
		let connectCallCount = 0;
		mockConnect.mockImplementation(
			(_client: Client, server: ServerConfiguration) => {
				connectCallCount++;
				if (connectCallCount === 1 || connectCallCount === 2) {
					return Promise.reject(new Error("Invalid server configuration"));
				}
				return Promise.resolve(mockTransport);
			},
		);

		mockLoggerError.mockClear();

		const configuration: Configuration = {
			mcp: {
				servers: {
					invalidServer1: { url: "http://server1.example.com" }, // Will trigger first error
					invalidServer2: { url: "http://server2.example.com" }, // Will trigger second error
					validServer: { url: "http://server3.example.com" },
				},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockConnect).toHaveBeenCalledTimes(3);
		expect(mockSetClientState).toHaveBeenCalledTimes(1); // Only 1 successful connection
		expect(mockLoggerWarn).toHaveBeenCalledTimes(2); // 2 validation failures
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			"Failed to connect to server invalidServer1: Invalid server configuration",
		);
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			"Failed to connect to server invalidServer2: Invalid server configuration",
		);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connected to 1/3 servers");
	});

	test("should handle connect function returning undefined", async () => {
		// Arrange
		let connectCallCount = 0;
		mockConnect.mockImplementation(
			(_client: Client, server: ServerConfiguration) => {
				connectCallCount++;
				if (connectCallCount === 1 || connectCallCount === 3) {
					return Promise.resolve(undefined); // Simulate retry failure
				}
				return Promise.resolve(mockTransport);
			},
		);

		mockLoggerError.mockClear();

		const configuration: Configuration = {
			mcp: {
				servers: {
					retryFailedServer1: { url: "http://server1.example.com" },
					successfulServer: { url: "http://server2.example.com" },
					retryFailedServer2: { url: "http://server3.example.com" },
				},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockConnect).toHaveBeenCalledTimes(3);
		expect(mockSetClientState).toHaveBeenCalledTimes(1); // Only 1 successful connection
		expect(mockLoggerWarn).toHaveBeenCalledTimes(2); // 2 undefined transport failures
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			"Failed to connect to server retryFailedServer1: No transport for server retryFailedServer1",
		);
		expect(mockLoggerWarn).toHaveBeenCalledWith(
			"Failed to connect to server retryFailedServer2: No transport for server retryFailedServer2",
		);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connected to 1/3 servers");
	});
});
