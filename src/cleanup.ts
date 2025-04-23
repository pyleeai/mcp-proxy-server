import { getAllClientStates } from "./data";
import { logger } from "./logger";

using log = logger;

export const cleanup = async (): Promise<void> => {
	log.info("Cleaning up client transports");

	await Promise.allSettled(
		getAllClientStates().map(async (client) => {
			try {
				const transport = await client.transport;
				if (transport) {
					log.debug(`Closing transport for client ${client.name}`);

					await transport.close();
				}
			} catch (error) {
				log.error(`Error closing transport for client ${client.name}`, error);
			}
		}),
	);
};
