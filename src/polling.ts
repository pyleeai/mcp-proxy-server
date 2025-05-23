import { reconnectClients } from "./clients";
import { areConfigurationsEqual, fetchConfiguration } from "./config";
import { CONFIGURATION_POLL_ENABLED, CONFIGURATION_POLL_INTERVAL } from "./env";
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
	if (!CONFIGURATION_POLL_ENABLED) {
		log.debug("Configuration polling is disabled");
		return () => {};
	}

	if (pollingInterval) {
		log.warn("Configuration polling is already running");
		return () => {};
	}

	currentConfiguration = initialConfiguration || null;

	log.info(
		`Starting configuration polling every ${CONFIGURATION_POLL_INTERVAL}ms`,
	);

	pollingInterval = setInterval(async () => {
		try {
			await pollConfiguration(configurationUrl, options?.headers);
		} catch (error) {
			log.error("Error during configuration polling", error);
		}
	}, CONFIGURATION_POLL_INTERVAL);

	return stopConfigurationPolling;
};

export const stopConfigurationPolling = (): void => {
	if (pollingInterval) {
		log.info("Stopping configuration polling");
		clearInterval(pollingInterval);
		pollingInterval = null;
		currentConfiguration = null;
	}
};

const pollConfiguration = async (
	configurationUrl?: string,
	headers?: Record<string, string>,
): Promise<void> => {
	log.debug("Polling for configuration changes");

	let newConfiguration: Configuration;
	try {
		newConfiguration = await fetchConfiguration(configurationUrl, headers);
	} catch (error) {
		log.error("Failed to fetch configuration during polling", error);
		return;
	}

	if (!currentConfiguration) {
		log.debug(
			"No previous configuration to compare, storing current configuration",
		);
		currentConfiguration = newConfiguration;
		return;
	}

	if (areConfigurationsEqual(currentConfiguration, newConfiguration)) {
		log.debug("Configuration unchanged");
		return;
	}

	log.info("Configuration changes detected, reconnecting clients");

	try {
		await reconnectClients(currentConfiguration, newConfiguration);
		currentConfiguration = newConfiguration;
		log.info("Successfully applied configuration changes");
	} catch (error) {
		log.error("Failed to apply configuration changes", error);
	}
};

export const getCurrentConfiguration = (): Configuration | null => {
	return currentConfiguration;
};
