import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { connect } from "../../src/connect";
import { logger } from "../../src/logger";
import * as transport from "../../src/transport";
import type { Server } from "../../src/types";
import * as utils from "../../src/utils";

describe("connect", () => {
	let mockClient: Client;
	let createHTTPTransportSpy: ReturnType<typeof spyOn>;
	let createSSETransportSpy: ReturnType<typeof spyOn>;
	let createStdioTransportSpy: ReturnType<typeof spyOn>;
	let retrySpy: ReturnType<typeof spyOn>;
	let connectSpy: ReturnType<typeof spyOn>;
	let mockHTTPTransport: Transport;
	let mockSSETransport: Transport;
	let mockStdioTransport: Transport;

	beforeEach(() => {
		spyOn(logger, "debug").mockImplementation(() => {});
		spyOn(logger, "warn").mockImplementation(() => {});
		spyOn(logger, "info").mockImplementation(() => {});
		spyOn(logger, "error").mockImplementation(() => {});
		spyOn(logger, "log").mockImplementation(() => {});
		mockHTTPTransport = {
			type: "http",
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
			close: () => Promise.resolve(),
		} as unknown as Transport;
		mockSSETransport = {
			type: "sse",
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
			close: () => Promise.resolve(),
		} as unknown as Transport;
		mockStdioTransport = {
			type: "stdio",
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
			close: () => Promise.resolve(),
		} as unknown as Transport;
		mockClient = {
			connect: () => Promise.resolve(),
		} as unknown as Client;
		connectSpy = spyOn(mockClient, "connect");
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
	});

	afterEach(() => {
		connectSpy.mockRestore();
		createHTTPTransportSpy.mockRestore();
		createSSETransportSpy.mockRestore();
		createStdioTransportSpy.mockRestore();
		retrySpy.mockRestore();
	});

	test("successfully connects using HTTP transport when server has URL", async () => {
		// Arrange
		const server: Server = { url: "http://example.com/v1" };

		// Act
		const result = await connect(mockClient, server);

		// Assert
		expect(createHTTPTransportSpy).toHaveBeenCalledWith(server);
		expect(connectSpy).toHaveBeenCalledWith(mockHTTPTransport);
		expect(createSSETransportSpy).not.toHaveBeenCalled();
		expect(createStdioTransportSpy).not.toHaveBeenCalled();
		expect(result).toBe(mockHTTPTransport);
	});

	test("falls back to SSE transport when HTTP connection fails", async () => {
		// Arrange
		const server: Server = { url: "http://example.com/v1" };
		const httpError = new Error("HTTP connection failed");
		connectSpy.mockImplementation((transport: unknown) => {
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
		expect(connectSpy).toHaveBeenCalledTimes(2);
		expect(createStdioTransportSpy).not.toHaveBeenCalled();
		expect(result).toBe(mockSSETransport);
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
		expect(connectSpy).toHaveBeenCalledWith(mockStdioTransport);
		expect(createHTTPTransportSpy).not.toHaveBeenCalled();
		expect(createSSETransportSpy).not.toHaveBeenCalled();
		expect(result).toBe(mockStdioTransport);
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
		connectSpy.mockImplementation(() =>
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
		expect(connectSpy).toHaveBeenCalledTimes(2);
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
