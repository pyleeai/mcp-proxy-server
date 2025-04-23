import { CONFIGURATION_URL } from "./env";
import { ConfigurationError } from "./errors";
import { logger } from "./logger";
import type { Configuration } from "./types";
import { fail } from "./utils";

using log = logger;

export const fetchConfiguration = async (): Promise<Configuration> => {
	const timeoutMs = 10000;

	if (!CONFIGURATION_URL) {
		return fail(
			"Required environment variable CONFIGURATION_URL is not defined",
			ConfigurationError,
		);
	}

	try {
		new URL(CONFIGURATION_URL);
	} catch {
		return fail(
			"The environment variable CONFIGURATION_URL is not a valid URL",
			ConfigurationError,
		);
	}

	log.debug(`Fetching configuration from ${CONFIGURATION_URL}`);

	let response: Response;
	try {
		response = await fetch(CONFIGURATION_URL, {
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

	log.debug("Successfully loaded configuration");

	return configuration;
};
