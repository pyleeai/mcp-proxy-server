import { createClient } from "./client";
import { connect } from "./connect";
import {
	getAllClientStates,
	removeClientMappings,
	removeClientState,
	setClientState,
} from "./data";
import { logger } from "./logger";
import type { Configuration } from "./types";

using log = logger;

export const connectClients = async (
	configuration: Configuration,
): Promise<void> => {
	const servers = Object.entries(configuration.mcp.servers);

	log.info(`Connecting to ${servers.length} servers`);

	for (const [name, server] of servers) {
		log.debug(`Connecting to ${name} server`);

		const client = createClient();
		const transport = await connect(client, server);

		setClientState(name, { name, client, transport });

		log.debug(`Connected to ${name} server`);
	}
};

export const disconnectClient = async (name: string): Promise<void> => {
	const clientStates = getAllClientStates();
	const clientState = clientStates.find((state) => state.name === name);

	if (clientState) {
		try {
			log.debug(`Disconnecting client ${name}`);

			if (clientState.transport) {
				await clientState.transport.close();
			}

			removeClientMappings(clientState.client);
			removeClientState(name);

			log.debug(`Disconnected client ${name}`);
		} catch (error) {
			log.error(`Error disconnecting client ${name}`, error);
		}
	}
};

export const reconnectClients = async (
	oldConfiguration: Configuration,
	newConfiguration: Configuration,
): Promise<void> => {
	const oldServers = new Set(Object.keys(oldConfiguration.mcp.servers));
	const newServers = Object.entries(newConfiguration.mcp.servers);

	for (const [name, server] of newServers) {
		const existed = oldServers.has(name);
		const configChanged =
			existed &&
			JSON.stringify(oldConfiguration.mcp.servers[name]) !==
				JSON.stringify(server);

		if (!existed) {
			log.debug(`Adding new server ${name}`);
		} else if (configChanged) {
			log.debug(`Reconnecting server ${name} due to configuration change`);
			await disconnectClient(name);
		} else {
			log.debug(
				`Server ${name} configuration unchanged, keeping existing connection`,
			);
			continue;
		}

		try {
			const client = createClient();
			const transport = await connect(client, server);
			setClientState(name, { name, client, transport });
			log.debug(`Successfully connected to ${name} server`);
		} catch (error) {
			log.error(`Failed to connect to ${name} server`, error);
		}
	}

	for (const oldServerName of oldServers) {
		if (!newConfiguration.mcp.servers[oldServerName]) {
			log.debug(`Removing server ${oldServerName}`);
			await disconnectClient(oldServerName);
		}
	}
};
