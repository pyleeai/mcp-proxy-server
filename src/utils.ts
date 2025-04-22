import { logger } from "./logger";
import type { RetryOptions } from "./types";

using log = logger;

export const delay = Bun.sleep;

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

export async function retry<T>(
	fn: () => T | Promise<T>,
	options: RetryOptions = {},
): Promise<T | undefined> {
	const {
		initialDelay = 1000,
		maxDelay = 30000,
		maxRetries = 3,
		backoffFactor = 2,
		fallbackValue = undefined,
	} = options;

	let attempt = 0;

	while (attempt <= maxRetries) {
		try {
			return await fn();
		} catch (error) {
			if (attempt >= maxRetries) {
				log.warn(
					`All ${maxRetries} retry attempts failed, returning ${fallbackValue}`,
					error,
				);
				return fallbackValue as T;
			}

			const time = Math.min(initialDelay * backoffFactor ** attempt, maxDelay);

			log.warn(`Attempt ${attempt + 1} failed, retrying in ${time}ms`, error);

			await delay(time);
			attempt++;
		}
	}
}

export const prefix = <U extends object, K extends keyof U = keyof U>(
	prefix: string,
	resourceOrValue: U | string | undefined,
	field?: K,
): U | string => {
	const prefixString = (value?: string): string => `[${prefix}] ${value || ""}`;

	if (
		field &&
		typeof resourceOrValue === "object" &&
		resourceOrValue !== null
	) {
		const fieldValue = resourceOrValue[field];
		const prefixedValue = prefixString(
			fieldValue as unknown as string | undefined,
		);

		return {
			...resourceOrValue,
			[field]: prefixedValue,
		};
	}

	return prefixString(resourceOrValue as unknown as string | undefined);
};
