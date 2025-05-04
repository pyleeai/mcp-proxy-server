import { CONFIGURATION_URL } from "./env";
import { ConfigurationError } from "./errors";
import { logger } from "./logger";
import type { Configuration } from "./types";
import { fail } from "./utils";

using log = logger;

export const fetchConfiguration = async (
	configurationUrl: string | undefined = CONFIGURATION_URL,
): Promise<Configuration> => {
	const timeoutMs = 10000;

	if (!configurationUrl) {
		return fail("No configuration URL found", ConfigurationError);
	}

	try {
		new URL(configurationUrl);
	} catch {
		return fail("The configuration URL is not valid", ConfigurationError);
	}

	log.debug(`Fetching configuration from ${configurationUrl}`);

	let response: Response;
	try {
		response = await fetch(configurationUrl, {
			method: "GET",
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(timeoutMs),
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			return fail(
				`Timeout fetching configuration (exceeded ${timeoutMs / 1000}s)`,
				ConfigurationError,
				error,
			);
		}
		return fail(
			"Network error fetching configuration",
			ConfigurationError,
			error,
		);
	}

	if (!response.ok) {
		fail(
			`Error fetching configuration (${response.status} ${response.statusText})`,
			ConfigurationError,
		);
	}

	let configuration: Configuration;
	try {
		configuration = await response.json();
	} catch (error) {
		return fail("Failed to parse configuration", ConfigurationError, error);
	}

	if (!configuration?.mcp?.servers) {
		return fail("Invalid configuration", ConfigurationError);
	}

	log.debug(`Successfully loaded configuration from ${configurationUrl}`);

	return configuration;
};
