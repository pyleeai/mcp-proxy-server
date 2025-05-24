import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
import { configuration } from "./config";
import { ProxyError } from "./errors";
import { setRequestHandlers } from "./handlers";
import { logger } from "./logger";
import { createServer } from "./server";
import type { Configuration } from "./types";
import { fail } from "./utils";

using log = logger;

export const server = createServer();

export const proxy = async (
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
) => {
	log.info("MCP Proxy Server starting");

	let abortController: AbortController;
	let configPolling: Promise<void>;

	try {
		setRequestHandlers(server);

		const configGen = configuration(configurationUrl, options);
		const initialResult = await configGen.next();

		if (initialResult.done) {
			fail("Failed to get initial configuration", ProxyError);
		}

		const config = initialResult.value as Configuration;
		await connectClients(config);
		await server.connect(new StdioServerTransport());

		log.info("MCP Proxy Server started");

		abortController = new AbortController();

		configPolling = (async () => {
			try {
				for await (const config of configGen) {
					if (abortController.signal.aborted) break;
					log.info("Configuration changed, reconnecting clients");
					await connectClients(config);
				}
			} catch (error) {
				if (!abortController.signal.aborted) {
					log.error("Error in configuration polling", error);
				}
			}
		})();
	} catch (error) {
		fail("Failed to start MCP Proxy Server", ProxyError, error);
	}

	return {
		[Symbol.dispose]: async () => {
			abortController?.abort();
			await configPolling?.catch(() => {});
			await cleanup();
			await server.close();
		},
	};
};
