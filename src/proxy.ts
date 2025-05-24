import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
import { clearAllClientStates, getAllClientStates } from "./data";
import { configuration } from "./config";
import { ProxyError } from "./errors";
import { setRequestHandlers } from "./handlers";
import { logger } from "./logger";
import { createServer } from "./server";
import { fail } from "./utils";

using log = logger;

export const server = createServer();

export const proxy = async (
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
) => {
	log.info("MCP Proxy Server starting");

	let isRunning = true;

	try {
		const transport = new StdioServerTransport();
		setRequestHandlers(server);

		// Get initial configuration and set up
		const configGen = configuration(configurationUrl, options);
		const initialResult = await configGen.next();
		
		if (initialResult.done) {
			fail("Failed to get initial configuration", ProxyError);
		}

		await connectClients(initialResult.value);
		await server.connect(transport);
		
		log.info("MCP Proxy Server started");

		// Start configuration polling in background
		const startPolling = async () => {
			try {
				for await (const config of configGen) {
					if (!isRunning) break;
					
					log.info("Configuration changed, reconnecting all clients");

					// Disconnect all existing clients
					const clients = getAllClientStates();
					await Promise.allSettled(
						clients.map(async (client) => {
							if (client.transport) {
								await client.transport.close();
							}
						}),
					);
					clearAllClientStates();

					// Connect to new configuration
					await connectClients(config);
				}
			} catch (error) {
				log.error("Error in configuration polling", error);
			}
		};
		
		startPolling();

	} catch (error) {
		fail("Failed to start MCP Proxy Server", ProxyError, error);
	}

	return {
		[Symbol.dispose]: async () => {
			isRunning = false;
			await cleanup();
			await server.close();
		},
	};
};
