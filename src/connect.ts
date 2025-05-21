import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { logger } from "./logger";
import {
	createHTTPTransport,
	createSSETransport,
	createStdioTransport,
} from "./transport";
import type { ServerConfiguration } from "./types";

using log = logger;

const CONNECTION_TIMEOUT_MS = 15000; // 15 seconds connection timeout

const connectOptions: RequestOptions = {
	timeout: CONNECTION_TIMEOUT_MS,
};

export const connect = async (client: Client, server: ServerConfiguration): Promise<Transport> => {
	if (server.url) {
		try {
			log.debug(`Attempting to connect using Streamable HTTP transport (timeout: ${CONNECTION_TIMEOUT_MS / 1000}s) to ${server.url}`);
			const httpTransport = createHTTPTransport(server);
			await client.connect(httpTransport, connectOptions);
			log.debug(`Successfully connected client using Streamable HTTP transport to ${server.url}`);
			return httpTransport;
		} catch (httpError: unknown) {
			let errorMessage = "Unknown error during HTTP connection";
			if (httpError instanceof Error) {
				errorMessage = httpError.message;
			}
			log.warn(
				`Streamable HTTP connection to ${server.url} failed: ${errorMessage}. Falling back to SSE transport.`,
			);
			if (httpError instanceof McpError && httpError.code === ErrorCode.RequestTimeout) {
				log.warn(`Streamable HTTP connection to ${server.url} timed out.`);
			}

			try {
				log.debug(`Attempting to connect using SSE transport (timeout: ${CONNECTION_TIMEOUT_MS / 1000}s) to ${server.url}`);
				const sseTransport = createSSETransport(server);
				await client.connect(sseTransport, connectOptions);
				log.debug(`Successfully connected client using SSE transport to ${server.url}`);
				return sseTransport;
			} catch (sseError: unknown) {
				let sseErrorMessage = "Unknown error during SSE connection";
				if (sseError instanceof Error) {
					sseErrorMessage = sseError.message;
				}
				log.error(`SSE connection to ${server.url} also failed: ${sseErrorMessage}`);
				if (sseError instanceof McpError && sseError.code === ErrorCode.RequestTimeout) {
					log.warn(`SSE connection to ${server.url} timed out.`);
				}
				throw new Error(`Failed to connect to server ${server.url} using both HTTP and SSE. Last error: ${sseErrorMessage}`);
			}
		}
	}

	if (server.command) {
		try {
			log.debug(`Attempting to connect using stdio transport (timeout: ${CONNECTION_TIMEOUT_MS / 1000}s) for command \"${server.command}\"`);
			const stdioTransport = createStdioTransport(server);
			await client.connect(stdioTransport, connectOptions);
			log.debug(`Successfully connected client using stdio transport for command \"${server.command}\"`);
			return stdioTransport;
		} catch (stdioError: unknown) {
			let stdioErrorMessage = "Unknown error during Stdio connection";
			if (stdioError instanceof Error) {
				stdioErrorMessage = stdioError.message;
			}
			log.error(`Stdio connection for command \"${server.command}\" failed: ${stdioErrorMessage}`);
			if (stdioError instanceof McpError && stdioError.code === ErrorCode.RequestTimeout) {
				log.warn(`Stdio connection for command \"${server.command}\" timed out.`);
			}
			throw new Error(`Failed to connect to server using command \"${server.command}\". Error: ${stdioErrorMessage}`);
		}
	}

	log.error("Server configuration is invalid: does not specify a URL or command for connection.", { serverDetails: server });
	throw new Error("Server configuration does not specify a URL or command for connection.");
};