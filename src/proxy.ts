import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
import { configuration, startConfigurationPolling } from "./config";
import { ProxyError, AuthenticationError } from "./errors";
import { setRequestHandlers } from "./handlers";
import { logger } from "./logger";
import { createServer } from "./server";
import type { Configuration } from "./types";

using log = logger;

export const server = createServer();

export const proxy = async (
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
) => {
	log.info("Proxy starting");

	const abortController = new AbortController();
	const transport = new StdioServerTransport();

	try {
		setRequestHandlers(server);

		const configGen = configuration(configurationUrl, options);

		let config: Configuration | undefined;
		try {
			const { value, done } = await configGen.next();
			if (!done) config = value as Configuration;
		} catch (error) {
			if (error instanceof AuthenticationError) throw error;
			log.warn(
				"Error fetching configuration (waiting for configuration)",
				error,
			);
		}

		if (config) {
			await connectClients(config);
			log.info("Proxy started");
		} else {
			log.info("Proxy started (waiting for configuration)");
		}

		await server.connect(transport);

		const configPolling = startConfigurationPolling(configGen, abortController);

		return {
			[Symbol.dispose]: async () => {
				abortController.abort();
				await configPolling.catch(() => {});
				await cleanup();
				await server.close();
			},
		};
	} catch (error) {
		if (error instanceof AuthenticationError) throw error;
		throw new ProxyError("Failed to start Proxy", error);
	}
};
