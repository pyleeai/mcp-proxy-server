import { createClient } from "./client";
import { connect } from "./connect";
import { setClientState } from "./data";
import { logger } from "./logger";
import type { Configuration } from "./types";

using log = logger;

export const connectClients = async (
	configuration: Configuration,
): Promise<void> => {
	const serverEntries = Object.entries(configuration.mcp.servers);

	if (serverEntries.length === 0) {
		log.info("No downstream servers configured to connect to.");
		return;
	}

	log.info(`Attempting to connect to ${serverEntries.length} downstream server(s) in parallel...`);

	const connectionPromises = serverEntries.map(async ([name, serverConfig]) => {
		try {
			log.debug(`Initiating connection to ${name} server (${serverConfig.url || serverConfig.command})...`);
			const client = createClient();
			// The 'connect' function now has internal timeouts and handles HTTP/SSE/Stdio
			const transport = await connect(client, serverConfig); 
			setClientState(name, { name, client, transport });
			log.info(`Successfully connected to ${name} server.`);
			return { name, status: "fulfilled" };
		} catch (error: unknown) {
			let errorMessage = "Unknown error";
			if (error instanceof Error) {
				errorMessage = error.message;
			}
			// The error from 'connect' should already be descriptive (e.g., "Failed to connect...timed out")
			log.error(`Failed to connect to ${name} server: ${errorMessage}`);
			return { name, status: "rejected", reason: errorMessage };
		}
	});

	// Wait for all connection attempts to settle (either fulfill or reject)
	const results = await Promise.allSettled(connectionPromises);

	let successfulConnections = 0;
	results.forEach(result => {
		if (result.status === "fulfilled" && result.value.status === "fulfilled") {
			successfulConnections++;
		}
		// Failures are already logged within the map iteration
	});

	log.info(`Finished all connection attempts. Successfully connected to ${successfulConnections} out of ${serverEntries.length} server(s).`);
	// The proxy server will continue to start up, even if some connections failed.
	// Handlers will need to be resilient to clients not being available.
};

