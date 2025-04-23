import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as clientModule from "../../src/client";
import { connectClients } from "../../src/clients";
import * as connectModule from "../../src/connect";
import * as dataModule from "../../src/data";
import { logger } from "../../src/logger";
import type { Configuration } from "../../src/types";

let mockCreateClient: ReturnType<typeof spyOn>;
let mockConnect: ReturnType<typeof spyOn>;
let mockSetClientState: ReturnType<typeof spyOn>;
let mockLoggerInfo: ReturnType<typeof spyOn>;

describe("createClients", () => {
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
		mockLoggerInfo = spyOn(logger, "info");
	});

	afterEach(() => {
		mockCreateClient.mockRestore();
		mockConnect.mockRestore();
		mockSetClientState.mockRestore();
		mockLoggerInfo.mockRestore();
	});

	test("should handle empty configuration with no servers", async () => {
		// Arrange
		const configuration: Configuration = {
			mcpServers: {},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connecting to 0 servers");
		expect(mockCreateClient).not.toHaveBeenCalled();
		expect(mockConnect).not.toHaveBeenCalled();
		expect(mockSetClientState).not.toHaveBeenCalled();
	});

	test("should process different server types correctly", async () => {
		// Arrange
		const configuration: Configuration = {
			mcpServers: {
				httpServer: { url: "http://server.example.com" },
				commandServer: { command: "some-command" },
				fullServer: {
					command: "full-command",
					args: ["--verbose"],
					env: ["ENV=production"],
					url: "http://fallback-url.example.com",
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
	});

	test("should create clients for each server in the configuration", async () => {
		// Arrange
		const configuration: Configuration = {
			mcpServers: {
				server1: { url: "http://server1.example.com" },
				server2: { command: "some-command", args: ["--arg1", "--arg2"] },
			},
		};

		// Act
		await connectClients(configuration);

		// Assert
		expect(mockLoggerInfo).toHaveBeenCalledWith("Connecting to 2 servers");
		expect(mockCreateClient).toHaveBeenCalledTimes(2);
		expect(mockConnect).toHaveBeenCalledTimes(2);
		expect(mockSetClientState).toHaveBeenCalledTimes(2);
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
	});
});
