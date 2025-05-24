import { createClient } from "./client";
import { connect } from "./connect";
import {
	setClientState,
	getAllClientStates,
	clearAllClientStates,
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

	const results = await Promise.allSettled(
		servers.map(async ([name, server]) => {
			const client = createClient();
			const transport = await connect(client, server);
			setClientState(name, { name, client, transport });
			return name;
		}),
	);

	const successful = results.filter((r) => r.status === "fulfilled").length;
	const failures = results.filter(
		(r) => r.status === "rejected",
	) as PromiseRejectedResult[];

	failures.forEach((failure) =>
		log.error("Failed to connect to client", failure.reason),
	);

	log.info(`Successfully connected to ${successful}/${servers.length} servers`);
};
