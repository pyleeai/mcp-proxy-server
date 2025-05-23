import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
import { fetchConfiguration } from "./config";
import { ProxyError } from "./errors";
import { setRequestHandlers } from "./handlers";
import { logger } from "./logger";
import { startConfigurationPolling, stopConfigurationPolling } from "./polling";
import { createServer } from "./server";
import { fail } from "./utils";

using log = logger;

export const server = createServer();

export const proxy = async (
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
) => {
	log.info("MCP Proxy Server starting");

	let stopPolling: (() => void) | null = null;

	try {
		const config = await fetchConfiguration(configurationUrl, options?.headers);
		const transport = new StdioServerTransport();

		setRequestHandlers(server);

		await connectClients(config);
		await server.connect(transport);

		stopPolling = startConfigurationPolling(configurationUrl, options, config);
	} catch (error) {
		fail("Failed to start MCP Proxy Server", ProxyError, error);
	}

	log.info("MCP Proxy Server started");

	return {
		[Symbol.dispose]: () => {
			return async () => {
				if (stopPolling) {
					stopPolling();
				}
				await cleanup();
				await server.close();
			};
		},
	};
};
