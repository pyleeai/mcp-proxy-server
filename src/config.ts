import { CONFIGURATION_POLL_INTERVAL, CONFIGURATION_URL } from "./env";
import { connectClients } from "./clients";
import { ConfigurationError, AuthenticationError } from "./errors";
import { logger } from "./logger";
import type { Configuration } from "./types";
import { delay } from "./utils";

using log = logger;

const fetchConfiguration = async (
	configurationUrl: string | undefined = CONFIGURATION_URL,
	headers?: Record<string, string>,
): Promise<Configuration> => {
	const timeoutMs = 10000;
	const defaultConfiguration: Configuration = {
		mcp: {
			servers: {},
		},
	};

	if (!configurationUrl) {
		log.warn("No configuration URL found, using default empty configuration");
		return defaultConfiguration;
	}

	try {
		new URL(configurationUrl);
	} catch {
		log.warn(
			"The configuration URL is not valid, using default empty configuration",
		);
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
		if (response.status === 401) {
			throw new AuthenticationError(
				`Authentication failed (${response.status} ${response.statusText})`,
			);
		}
		log.warn(
			`Error fetching configuration (${response.status} ${response.statusText}), using default empty configuration`,
		);
		return defaultConfiguration;
	}

	let configuration: Configuration;
	try {
		configuration = await response.json();
	} catch (error) {
		throw new ConfigurationError("Failed to parse configuration", error);
	}

	if (!configuration?.mcp?.servers) {
		throw new ConfigurationError("Invalid configuration");
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

export async function* configurations(
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
			const configChanged =
				!currentConfiguration ||
				!areConfigurationsEqual(currentConfiguration, newConfiguration);

			if (configChanged) {
				log.info("Configuration changed");
				currentConfiguration = newConfiguration;
				yield newConfiguration;
			}
		} catch (error) {
			if (error instanceof AuthenticationError) {
				throw error;
			}
			log.error("Error fetching configuration");
		}

		if (CONFIGURATION_POLL_INTERVAL <= 0) {
			break;
		}

		await delay(CONFIGURATION_POLL_INTERVAL);
	}
}

export const startConfigurationPolling = async (
	configGen: AsyncGenerator<Configuration>,
	abortController: AbortController,
) => {
	try {
		for await (const config of configGen) {
			if (abortController.signal.aborted) break;
			log.info("Configuration changed, reconnecting clients");
			await connectClients(config);
		}
	} catch (error) {
		if (error instanceof AuthenticationError) {
			throw error;
		}
		if (!abortController.signal.aborted) {
			log.error("Error in configuration polling", error);
		}
	}
};

export const initializeConfiguration = async (
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
	abortController?: AbortController,
): Promise<Configuration | undefined> => {
	const generator = configurations(configurationUrl, options);
	const next = await generator.next();
	const configuration = next.value;

	if (abortController) {
		startConfigurationPolling(generator, abortController);
	}

	return configuration;
};
