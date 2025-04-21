import { createClient } from "./client";
import { connect } from "./connect";
import { setClientState } from "./data";
import { logger } from "./logger";
import type { Configuration } from "./types";

using log = logger;

export const createClients = (configuration: Configuration): void => {
	const servers = Object.entries(configuration.mcpServers);

	log.info(`Connecting to ${servers.length} servers`);

	for (const [name, server] of servers) {
		const client = createClient(server);
		const transport = connect(client, server);

		setClientState(name, { name, client, transport });
	}
};
