import { CONFIGURATION_URL, CONFIGURATION_POLL_INTERVAL } from "./env";
import { ConfigurationError } from "./errors";
import { logger } from "./logger";
import type { Configuration } from "./types";
import { fail } from "./utils";

using log = logger;

const fetchConfiguration = async (
	configurationUrl: string | undefined = CONFIGURATION_URL,
	headers?: Record<string, string>,
): Promise<Configuration> => {
	const timeoutMs = 10000;
	const defaultConfiguration: Configuration = {
		mcp: {
			servers: {}
		}
	};

	if (!configurationUrl) {
		log.warn("No configuration URL found, using default empty configuration");
		return defaultConfiguration;
	}

	try {
		new URL(configurationUrl);
	} catch {
		log.warn("The configuration URL is not valid, using default empty configuration");
		return defaultConfiguration;
	}

	log.debug(`Fetching configuration from ${configurationUrl}`);

	let response: Response;
	try {
		response = await fetch(configurationUrl, {
			method: "GET",
			headers: {
				...headers,
				Accept: "application/json",
			},
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			log.warn(
				`Timeout fetching configuration (exceeded ${timeoutMs / 1000}s), using default empty configuration`,
				error,
			);
		} else {
			log.warn(
				"Network error fetching configuration, using default empty configuration",
				error,
			);
		}
		return defaultConfiguration;
	}

	if (!response.ok) {
		log.warn(
			`Error fetching configuration (${response.status} ${response.statusText}), using default empty configuration`,
		);
		return defaultConfiguration;
	}

	let configuration: Configuration;
	try {
		configuration = await response.json();
	} catch (error) {
		return fail("Failed to parse configuration", ConfigurationError);
	}

	if (!configuration?.mcp?.servers) {
		return fail("Invalid configuration", ConfigurationError);
	}

	log.debug(`Successfully loaded configuration from ${configurationUrl}`);

	return configuration;
};

export const areConfigurationsEqual = (
	config1: Configuration,
	config2: Configuration,
): boolean => {
	return JSON.stringify(config1) === JSON.stringify(config2);
};

export async function* configuration(
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
): AsyncGenerator<Configuration, void, unknown> {
	let currentConfiguration: Configuration | null = null;

	while (true) {
		try {
			const newConfiguration = await fetchConfiguration(
				configurationUrl,
				options?.headers,
			);

			const configChanged = !currentConfiguration || !areConfigurationsEqual(currentConfiguration, newConfiguration);
			
			if (configChanged) {
			  log.info("Configuration changed")
				currentConfiguration = newConfiguration;
				yield newConfiguration;
			}

			// If polling is disabled, exit after first fetch
			if (CONFIGURATION_POLL_INTERVAL <= 0) {
				break;
			}
		} catch (error) {
			log.error("Error fetching configuration", error);
		
			// If polling is disabled, don't retry
			if (CONFIGURATION_POLL_INTERVAL <= 0) {
				return;
			}
		}
	
		// Wait for next poll interval
		await new Promise(resolve => setTimeout(resolve, CONFIGURATION_POLL_INTERVAL));
	}
}