import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { logger } from "./logger";
import {
	createHTTPTransport,
	createSSETransport,
	createStdioTransport,
} from "./transport";
import type { Server } from "./types";
import { retry } from "./utils";

using log = logger;

export const connect = async (client: Client, server: Server) => {
	return await retry(async () => {
		if (server.url) {
			try {
				const transport = createHTTPTransport(server);
				log.debug("Connecting using Streamable HTTP transport");
				await client.connect(transport);
				log.debug("Connected using Streamable HTTP transport");
				return transport;
			} catch (error) {
				log.warn(
					"Streamable HTTP connection failed, falling back to SSE transport",
				);
				const transport = createSSETransport(server);
				log.debug("Connecting using SSE transport");
				await client.connect(transport);
				log.debug("Connected using SSE transport");
				return transport;
			}
		}

		if (server.command) {
			const transport = createStdioTransport(server);
			log.debug("Connecting using stdio transport");
			await client.connect(transport);
			log.debug("Connected using stdio transport");
			return transport;
		}
	});
};
