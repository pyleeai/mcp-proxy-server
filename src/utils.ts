import { logger } from "./logger";

using log = logger;

export function fail<T extends Error>(
	message: string,
	errorClass: new (
		message: string,
		cause?: unknown,
	) => T = Error as unknown as new (
		message: string,
		cause?: unknown,
	) => T,
	error?: unknown,
): never {
	if (error instanceof Error) {
		log.error(`${message}`, error);
		throw new errorClass(`${message}: ${error.message}`, error);
	}
	log.error(`${message}${error ? `: ${String(error)}` : ""}`);
	throw new errorClass(`${message}${error ? `: ${String(error)}` : ""}`, error);
}
