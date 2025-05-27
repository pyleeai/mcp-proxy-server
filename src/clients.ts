import { createClient } from "./client";
import { connect } from "./connect";
import {
	clearAllClientStates,
	getAllClientStates,
	setClientState,
} from "./data";
import { logger } from "./logger";
import type { Configuration } from "./types";

using log = logger;

export const connectClients = async (
	configuration: Configuration,
): Promise<void> => {
	const clients = getAllClientStates();
	if (clients.length > 0) {
		log.info("Disconnecting existing clients");
		await Promise.allSettled(
			clients.map(async (client) => client.transport?.close()),
		);
		clearAllClientStates();
	}

	const servers = Object.entries(configuration.mcp.servers);

	if (servers.length === 0) {
		log.info("No servers to connect");
		return;
	}

	log.info(`Connecting to ${servers.length} servers`);

	const results = await Promise.allSettled(
		servers.map(async ([name, server]) => {
			try {
				const client = createClient();
				const transport = await connect(client, server);
				if (!transport) throw new Error(`No transport for server ${name}`);
				setClientState(name, { name, client, transport });
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				log.warn(`Failed to connect to server ${name}: ${errorMessage}`);
				throw error;
			}
		}),
	);

	const successful = results.filter((r) => r.status === "fulfilled").length;

	log.info(`Connected to ${successful}/${servers.length} servers`);
};
