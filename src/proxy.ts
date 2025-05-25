import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
import { configuration, startConfigurationPolling } from "./config";
import { ProxyError, AuthenticationError, ConfigurationError } from "./errors";
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

	let configPolling: Promise<void>;
	const abortController = new AbortController();
	const transport = new StdioServerTransport();

	try {
		setRequestHandlers(server);

		const configGen = configuration(configurationUrl, options);
		const initialResult = await configGen.next();

		if (initialResult.done) {
			fail("Failed to get initial configuration", ConfigurationError);
		}

		const config = initialResult.value as Configuration;
		await connectClients(config);
		await server.connect(transport);

		configPolling = startConfigurationPolling(configGen, abortController);

		log.info("MCP Proxy Server started");
	} catch (error) {
		if (error instanceof AuthenticationError) {
			throw error;
		}
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
