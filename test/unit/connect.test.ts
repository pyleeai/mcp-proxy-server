import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { connect } from "../../src/connect";
import { logger } from "../../src/logger";
import * as transport from "../../src/transport";
import type { Server } from "../../src/types";
import * as utils from "../../src/utils";

const mockHTTPTransport = {
	type: "http",
	start: mock(() => Promise.resolve()),
	send: mock(() => Promise.resolve()),
	close: mock(() => Promise.resolve()),
} as unknown as Transport;
const mockSSETransport = {
	type: "sse",
	start: mock(() => Promise.resolve()),
	send: mock(() => Promise.resolve()),
	close: mock(() => Promise.resolve()),
} as unknown as Transport;
const mockStdioTransport = {
	type: "stdio",
	start: mock(() => Promise.resolve()),
	send: mock(() => Promise.resolve()),
	close: mock(() => Promise.resolve()),
} as unknown as Transport;

describe("connect", () => {
	let mockClient: Client;
	let createHTTPTransportSpy: ReturnType<typeof spyOn>;
	let createSSETransportSpy: ReturnType<typeof spyOn>;
	let createStdioTransportSpy: ReturnType<typeof spyOn>;
	let retrySpy: ReturnType<typeof spyOn>;
	let loggerDebugSpy: ReturnType<typeof spyOn>;
	let loggerWarnSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockClient = {
			connect: mock(() => Promise.resolve()),
		} as unknown as Client;
		createHTTPTransportSpy = spyOn(
			transport,
			"createHTTPTransport",
		).mockImplementation(() => mockHTTPTransport);
		createSSETransportSpy = spyOn(
			transport,
			"createSSETransport",
		).mockImplementation(() => mockSSETransport);
		createStdioTransportSpy = spyOn(
			transport,
			"createStdioTransport",
		).mockImplementation(() => mockStdioTransport);
		retrySpy = spyOn(utils, "retry").mockImplementation(
			<T>(fn: () => T | Promise<T>) => Promise.resolve(fn()),
		);
		loggerDebugSpy = spyOn(logger, "debug");
		loggerWarnSpy = spyOn(logger, "warn");
	});

	afterEach(() => {
		createHTTPTransportSpy.mockRestore();
		createSSETransportSpy.mockRestore();
		createStdioTransportSpy.mockRestore();
		retrySpy.mockRestore();
		loggerDebugSpy.mockRestore();
		loggerWarnSpy.mockRestore();
	});

	test("successfully connects using HTTP transport when server has URL", async () => {
		// Arrange
		const server: Server = { url: "http://example.com/v1" };

		// Act
		const result = await connect(mockClient, server);

		// Assert
		expect(createHTTPTransportSpy).toHaveBeenCalledWith(server);
		expect(mockClient.connect).toHaveBeenCalledWith(mockHTTPTransport);
		expect(createSSETransportSpy).not.toHaveBeenCalled();
		expect(createStdioTransportSpy).not.toHaveBeenCalled();
		expect(result).toBe(mockHTTPTransport);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Connecting using Streamable HTTP transport",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Connected using Streamable HTTP transport",
		);
		expect(loggerWarnSpy).not.toHaveBeenCalled();
	});

	test("falls back to SSE transport when HTTP connection fails", async () => {
		// Arrange
		const server: Server = { url: "http://example.com/v1" };
		const httpError = new Error("HTTP connection failed");
		mockClient.connect = mock((transport) => {
			if (transport === mockHTTPTransport) {
				return Promise.reject(httpError);
			}
			return Promise.resolve();
		});

		// Act
		const result = await connect(mockClient, server);

		// Assert
		expect(createHTTPTransportSpy).toHaveBeenCalledWith(server);
		expect(createSSETransportSpy).toHaveBeenCalledWith(server);
		expect(mockClient.connect).toHaveBeenCalledTimes(2);
		expect(createStdioTransportSpy).not.toHaveBeenCalled();
		expect(result).toBe(mockSSETransport);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Connecting using Streamable HTTP transport",
		);
		expect(loggerWarnSpy).toHaveBeenCalledWith(
			"Streamable HTTP connection failed, falling back to SSE transport",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Connecting using SSE transport",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Connected using SSE transport",
		);
	});

	test("uses stdio transport when server has command", async () => {
		// Arrange
		const server: Server = {
			command: "some-command",
			args: ["--arg1", "--arg2"],
			env: ["KEY=value"],
		};

		// Act
		const result = await connect(mockClient, server);

		// Assert
		expect(createStdioTransportSpy).toHaveBeenCalledWith(server);
		expect(mockClient.connect).toHaveBeenCalledWith(mockStdioTransport);
		expect(createHTTPTransportSpy).not.toHaveBeenCalled();
		expect(createSSETransportSpy).not.toHaveBeenCalled();
		expect(result).toBe(mockStdioTransport);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Connecting using stdio transport",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Connected using stdio transport",
		);
	});

	test("uses retry mechanism for connection attempts", async () => {
		// Arrange
		const server: Server = { url: "http://example.com/v1" };

		// Act
		await connect(mockClient, server);

		// Assert
		expect(retrySpy).toHaveBeenCalled();
		expect(retrySpy.mock.calls[0][0]).toBeInstanceOf(Function);
	});

	test("returns undefined when both HTTP and SSE transports fail and no command is available", async () => {
		// Arrange
		const server: Server = { url: "http://example.com/v1" };
		mockClient.connect = mock(() =>
			Promise.reject(new Error("Connection failed")),
		);
		retrySpy.mockImplementation(async <T>(fn: () => T | Promise<T>) => {
			try {
				return await fn();
			} catch {
				return undefined;
			}
		});

		// Act
		const result = await connect(mockClient, server);

		// Assert
		expect(result).toBeUndefined();
		expect(createHTTPTransportSpy).toHaveBeenCalledWith(server);
		expect(createSSETransportSpy).toHaveBeenCalledWith(server);
		expect(mockClient.connect).toHaveBeenCalledTimes(2);
	});

	test("returns undefined when no connection method is available", async () => {
		// Arrange
		const server: Server = {};
		retrySpy.mockImplementation(async <T>(fn: () => T | Promise<T>) => {
			try {
				return await fn();
			} catch {
				return undefined;
			}
		});

		// Act
		const result = await connect(mockClient, server);

		// Assert
		expect(result).toBeUndefined();
		expect(createHTTPTransportSpy).not.toHaveBeenCalled();
		expect(createSSETransportSpy).not.toHaveBeenCalled();
		expect(createStdioTransportSpy).not.toHaveBeenCalled();
	});
});
