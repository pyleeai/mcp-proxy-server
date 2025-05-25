import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
import { configuration, startConfigurationPolling } from "./config";
import { ProxyError, AuthenticationError, ConfigurationError } from "./errors";
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
	log.info("MCP Proxy Server starting");

	let configPolling: Promise<void>;
	const abortController = new AbortController();
	const transport = new StdioServerTransport();

	try {
		setRequestHandlers(server);

		const configGen = configuration(configurationUrl, options);
		let hasInitialConfig = false;

		try {
			const initialResult = await configGen.next();
			if (!initialResult.done) {
				const config = initialResult.value as Configuration;
				await connectClients(config);
				hasInitialConfig = true;
				log.info("MCP Proxy Server started with initial configuration");
			} else {
				log.warn(
					"Failed to get initial configuration, will keep polling for viable config",
				);
			}
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}
			log.warn(
				"Error fetching initial configuration, will keep polling for viable config",
				error,
			);
		}

		await server.connect(transport);

		configPolling = startConfigurationPolling(configGen, abortController);

		if (!hasInitialConfig) {
			log.info("MCP Proxy Server started (waiting for configuration)");
		}
	} catch (error) {
		if (error instanceof AuthenticationError) {
			throw error;
		}
		throw new ProxyError("Failed to start MCP Proxy Server", error);
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
