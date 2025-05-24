import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import * as clientModule from "../../src/client";
import { connectClients } from "../../src/clients";
import * as connectModule from "../../src/connect";
import * as dataModule from "../../src/data";
import { logger } from "../../src/logger";
import type { Configuration, ClientState } from "../../src/types";

let mockCreateClient: ReturnType<typeof spyOn>;
let mockConnect: ReturnType<typeof spyOn>;
let mockSetClientState: ReturnType<typeof spyOn>;
let mockGetAllClientStates: ReturnType<typeof spyOn>;
let mockClearAllClientStates: ReturnType<typeof spyOn>;
let mockLoggerInfo: ReturnType<typeof spyOn>;
let mockLoggerDebug: ReturnType<typeof spyOn>;

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
		mockGetAllClientStates = spyOn(dataModule, "getAllClientStates").mockImplementation(
			() => [],
		);
		mockClearAllClientStates = spyOn(dataModule, "clearAllClientStates");
		mockLoggerInfo = spyOn(logger, "info");
		mockLoggerDebug = spyOn(logger, "debug");
	});

	afterEach(() => {
		mockCreateClient.mockRestore();
		mockConnect.mockRestore();
		mockSetClientState.mockRestore();
		mockGetAllClientStates.mockRestore();
		mockClearAllClientStates.mockRestore();
		mockLoggerInfo.mockRestore();
		mockLoggerDebug.mockRestore();
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
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connecting to 0 servers");
		expect(mockCreateClient).not.toHaveBeenCalled();
		expect(mockConnect).not.toHaveBeenCalled();
		expect(mockSetClientState).not.toHaveBeenCalled();
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
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connecting to 3 servers");
		expect(mockCreateClient).toHaveBeenCalledTimes(3);
		expect(mockConnect).toHaveBeenCalledTimes(3);
		expect(mockSetClientState).toHaveBeenCalledTimes(3);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Connecting to httpServer server",
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Connected to httpServer server",
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Connecting to commandServer server",
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Connected to commandServer server",
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Connecting to fullServer server",
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Connected to fullServer server",
		);
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
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connecting to 2 servers");
		expect(mockCreateClient).toHaveBeenCalledTimes(2);
		expect(mockConnect).toHaveBeenCalledTimes(2);
		expect(mockSetClientState).toHaveBeenCalledTimes(2);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Connecting to server1 server",
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith("Connected to server1 server");
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Connecting to server2 server",
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith("Connected to server2 server");
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
		expect(mockClearAllClientStates).not.toHaveBeenCalled();
	});

	test("should disconnect existing clients before connecting new ones", async () => {
		// Arrange
		const mockClose1 = spyOn({}, "close" as any).mockImplementation(() => Promise.resolve());
		const mockClose2 = spyOn({}, "close" as any).mockImplementation(() => Promise.resolve());
		
		const existingTransport1 = {
			close: mockClose1,
		} as unknown as Transport;
		const existingTransport2 = {
			close: mockClose2,
		} as unknown as Transport;

		const existingClients: ClientState[] = [
			{
				name: "existing1",
				client: {} as Client,
				transport: existingTransport1,
			},
			{
				name: "existing2", 
				client: {} as Client,
				transport: existingTransport2,
			},
		];

		mockGetAllClientStates.mockImplementation(() => existingClients);

		const configuration: Configuration = {
			mcp: {
				servers: {
					newServer: { url: "http://new-server.example.com" },
				},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Disconnecting existing clients");
		expect(mockClose1).toHaveBeenCalledTimes(1);
		expect(mockClose2).toHaveBeenCalledTimes(1);
		expect(mockClearAllClientStates).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connecting to 1 servers");
	});

	test("should handle clients without transport during disconnection", async () => {
		// Arrange
		const mockClose = spyOn({}, "close" as any).mockImplementation(() => Promise.resolve());
		
		const existingTransport = {
			close: mockClose,
		} as unknown as Transport;

		const existingClients: ClientState[] = [
			{
				name: "existing1",
				client: {} as Client,
				transport: existingTransport,
			},
			{
				name: "existing2",
				client: {} as Client,
				transport: undefined,
			},
		];

		mockGetAllClientStates.mockImplementation(() => existingClients);

		const configuration: Configuration = {
			mcp: {
				servers: {},
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith("Disconnecting existing clients");
		expect(mockClose).toHaveBeenCalledTimes(1);
		expect(mockClearAllClientStates).toHaveBeenCalledTimes(1);
	});

	test("should connect to multiple servers in parallel", async () => {
		// Arrange
		let connectCallCount = 0;
		const connectDelays = [100, 50, 75];
		
		mockConnect.mockImplementation(() => {
			const delay = connectDelays[connectCallCount++];
			return new Promise(resolve => {
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
});
