import { CONFIGURATION_URL } from "./env";
import { ConfigurationError } from "./errors";
import { logger } from "./logger";
import type { Configuration } from "./types";
import { fail } from "./utils";

using log = logger;

export const fetchConfiguration = async (
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
