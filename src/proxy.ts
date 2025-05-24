import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
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

	try {
		setRequestHandlers(server);

		const configGen = configuration(configurationUrl, options);
		const initialResult = await configGen.next();
		
		if (initialResult.done) {
			fail("Failed to get initial configuration", ProxyError);
		}

		await connectClients(initialResult.value);
		await server.connect(new StdioServerTransport());
		
		log.info("MCP Proxy Server started");

		(async () => {
			try {
				for await (const config of configGen) {
					log.info("Configuration changed, reconnecting clients");
					await connectClients(config);
				}
			} catch (error) {
				log.error("Error in configuration polling", error);
			}
		})();

	} catch (error) {
		fail("Failed to start MCP Proxy Server", ProxyError, error);
	}

	return {
		[Symbol.dispose]: async () => {
			await cleanup();
			await server.close();
		},
	};
};
