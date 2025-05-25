import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
import { initializeConfiguration } from "./config";
import { setRequestHandlers } from "./handlers";
import { logger } from "./logger";
import { createServer } from "./server";

using log = logger;

export const server = createServer();

export const proxy = async (
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
) => {
	log.info("Proxy starting");

	const abortController = new AbortController();
	const transport = new StdioServerTransport();
	const configuration = await initializeConfiguration(
		configurationUrl,
		options,
		abortController,
	);

	setRequestHandlers(server);

	if (configuration) await connectClients(configuration);

	await server.connect(transport);

	log.info(
		configuration
			? "Proxy started"
			: "Proxy started (waiting for configuration)",
	);

	return {
		[Symbol.dispose]: async () => {
			abortController.abort();
			await cleanup();
			await server.close();
		},
	};
};
