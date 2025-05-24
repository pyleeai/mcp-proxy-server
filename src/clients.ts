import { createClient } from "./client";
import { connect } from "./connect";
import { setClientState, getAllClientStates, clearAllClientStates } from "./data";
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
			clients.map(async (client) => {
				if (client.transport) {
					await client.transport.close();
				}
			}),
		);
		clearAllClientStates();
	}

	const servers = Object.entries(configuration.mcp.servers);

	log.info(`Connecting to ${servers.length} servers`);

	await Promise.all(
		servers.map(async ([name, server]) => {
			log.debug(`Connecting to ${name} server`);

			const client = createClient();
			const transport = await connect(client, server);

			setClientState(name, { name, client, transport });

			log.debug(`Connected to ${name} server`);
		})
	);
};
