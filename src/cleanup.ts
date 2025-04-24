import { getAllClientStates } from "./data";
import { logger } from "./logger";

using log = logger;

export const cleanup = async (): Promise<void> => {
	const clients = getAllClientStates();

	if (clients.length > 0) {
		log.info(`Cleaning up ${clients.length} clients`);
	}

	await Promise.allSettled(
		clients.map(async (client) => {
			try {
				if (client.transport) {
					log.debug(`Closing transport for client ${client.name}`);
					await client.transport.close();
				}
			} catch (error) {
				log.error(`Error closing transport for client ${client.name}`, error);
			}
		}),
	);

	if (clients.length > 0) {
		log.info(`Cleaned up ${clients.length} clients`);
	}
};
