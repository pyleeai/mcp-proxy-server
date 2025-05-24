import { connectClients } from "./clients";
import { areConfigurationsEqual, fetchConfiguration } from "./config";
import { clearAllClientStates, getAllClientStates } from "./data";
import { CONFIGURATION_POLL_INTERVAL } from "./env";
import { logger } from "./logger";
import type { Configuration } from "./types";

using log = logger;

let pollingInterval: Timer | null = null;
let currentConfiguration: Configuration | null = null;

export const startConfigurationPolling = (
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
	initialConfiguration?: Configuration,
): (() => void) => {
	if (CONFIGURATION_POLL_INTERVAL <= 0) {
		return () => {};
	}

	if (pollingInterval) {
		return stopConfigurationPolling;
	}

	currentConfiguration = initialConfiguration || null;

	pollingInterval = setInterval(async () => {
		try {
			const newConfiguration = await fetchConfiguration(
				configurationUrl,
				options?.headers,
			);

			if (
				!currentConfiguration ||
				!areConfigurationsEqual(currentConfiguration, newConfiguration)
			) {
				log.info("Configuration changed, reconnecting all clients");

				// Disconnect all existing clients
				const clients = getAllClientStates();
				await Promise.allSettled(
					clients.map(async (client) => {
						if (client.transport) {
							await client.transport.close();
						}
					}),
				);
				clearAllClientStates();

				// Connect to new configuration
				await connectClients(newConfiguration);
				currentConfiguration = newConfiguration;
			}
		} catch (error) {
			log.error("Error during configuration polling", error);
		}
	}, CONFIGURATION_POLL_INTERVAL);

	return stopConfigurationPolling;
};

export const stopConfigurationPolling = (): void => {
	if (pollingInterval) {
		clearInterval(pollingInterval);
		pollingInterval = null;
		currentConfiguration = null;
	}
};
