import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { logger } from "../../src/logger";
import * as transport from "../../src/transport";
import type { ServerConfiguration } from "../../src/types";

describe("transport", () => {
	let loggerDebugSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		loggerDebugSpy = spyOn(logger, "debug");
	});

	describe("createHTTPTransport", () => {
		test("throws an error when URL is missing", () => {
			// Arrange
			const server: ServerConfiguration = {};

			// Act & Assert
			expect(() => transport.createHTTPTransport(server)).toThrow();
		});

		test("creates a StreamableHTTPClientTransport with the correct URL", () => {
			// Arrange
			const server: ServerConfiguration = {
				url: "http://example.com/api",
			};

			// Act
			const result = transport.createHTTPTransport(server);

			// Assert
			expect(result).toBeInstanceOf(StreamableHTTPClientTransport);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Creating HTTP transport for http://example.com/api",
			);
		});
	});

	describe("createSSETransport", () => {
		test("throws an error when URL is missing", () => {
			// Arrange
			const server: ServerConfiguration = {};

			// Act & Assert
			expect(() => transport.createSSETransport(server)).toThrow();
		});

		test("creates an SSEClientTransport with the correct URL", () => {
			// Arrange
			const server: ServerConfiguration = {
				url: "http://example.com/events",
			};

			// Act
			const result = transport.createSSETransport(server);

			// Assert
			expect(result).toBeInstanceOf(SSEClientTransport);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Creating SSE transport for http://example.com/events",
			);
		});
	});

	describe("createStdioTransport", () => {
		test("throws an error when command is missing", () => {
			// Arrange
			const server: ServerConfiguration = {};

			// Act & Assert
			expect(() => transport.createStdioTransport(server)).toThrow();
		});

		test("creates a StdioClientTransport instance", () => {
			// Arrange
			const server: ServerConfiguration = {
				command: "python",
				args: ["-m", "server.py"],
				env: ["API_KEY=abc123", "DEBUG=true"],
			};

			// Act
			const result = transport.createStdioTransport(server);

			// Assert
			expect(result).toBeInstanceOf(StdioClientTransport);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Creating Stdio transport using python -m server.py",
			);
		});
	});
});
