import type { z } from "zod";
import { getAllClients, getRequestCache, setRequestCache } from "./data";
import { logger } from "./logger";
import type {
	GetRequestHandlerConfig,
	ListRequestHandlerCallback,
	ListRequestHandlerConfig,
} from "./types";

using log = logger;

export function getRequestHandler<
	P extends Record<string, unknown>,
	R extends object,
>(schema: z.ZodType<R>, config: GetRequestHandlerConfig) {
	return async ({ params }: { params: P }) => {
		const { method, param } = config;
		const key = params[param] as string;
		const client = getRequestCache(method, key);

		try {
			log.debug(`Forwarding ${method} : ${param} request`);
			return await client.client.request({ method, params }, schema);
		} catch (error) {
			log.error(
				`Forwarding error with ${method} : ${param} request to ${client.name}`,
				error,
			);
			return {};
		}
	};
}

export function listRequestHandler<
	P extends Record<string, unknown>,
	R extends object,
>(
	schema: z.ZodType<R>,
	config: ListRequestHandlerConfig<R>,
	callback: ListRequestHandlerCallback,
) {
	return async ({ params }: { method: string; params?: P }) => {
		const { method, key } = config;
		const clients = getAllClients();
		const response = {
			[key as string]: (
				await Promise.all(
					clients.map(async (client) => {
						try {
							log.debug(`Collecting ${method} from ${client.name}`);
							const result = await client.client.request(
								{ method, params },
								schema,
							);
							log.debug(`Collected ${method} from ${client.name}`);
							const items = result[key];
							return Array.isArray(items)
								? items.map((item) => {
										setRequestCache(method, item.id, client);
										return callback(client, item);
									})
								: [];
						} catch (error) {
							log.error(
								`Error collecting ${method} from ${client.name}`,
								error,
							);
							return [];
						}
					}),
				)
			).flat(),
		} as R;

		return response;
	};
}
