import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { logger } from "./logger";
import {
	createHTTPTransport,
	createSSETransport,
	createStdioTransport,
} from "./transport";
import type { ServerConfiguration } from "./types";
import { retry } from "./utils";

using log = logger;

export const connect = async (client: Client, server: ServerConfiguration) => {
	return await retry(async () => {
		if (server.url) {
			try {
				log.debug("Connecting using Streamable HTTP transport");
				const transport = createHTTPTransport(server);
				await client.connect(transport);
				log.debug("Connected using Streamable HTTP transport");
				return transport;
			} catch (error) {
				log.warn(
					"Streamable HTTP connection failed, falling back to SSE transport",
				);
				log.debug("Connecting using SSE transport");
				const transport = createSSETransport(server);
				await client.connect(transport);
				log.debug("Connected using SSE transport");
				return transport;
			}
		}

		if (server.command) {
			log.debug("Connecting using stdio transport");
			const transport = createStdioTransport(server);
			await client.connect(transport);
			log.debug("Connected using stdio transport");
			return transport;
		}
	});
};
