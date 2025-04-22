import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Result } from "@modelcontextprotocol/sdk/types.js";
import type { ZodLiteral, ZodObject, z } from "zod";
import {
	getAllClients,
	getClientFor,
	getKeyFor,
	getReadMethodFor,
	setClientFor,
} from "./data";
import { ClientRequestError } from "./errors";
import { logger } from "./logger";
import type { ListRequestHandlerCallback, RequestHandler } from "./types";
import { fail } from "./utils";

using log = logger;

export async function clientRequest<
	RequestSchema extends ZodObject<{
		method: ZodLiteral<string>;
		params: ZodObject<{
			name?: ZodLiteral<string> | z.ZodString;
			uri?: ZodLiteral<string> | z.ZodString;
		}>;
	}>,
	ResultSchema extends z.ZodType,
>(
	client: Client,
	request: z.infer<RequestSchema>,
	resultSchema: ResultSchema,
	method: string,
	identifier?: string | unknown | undefined,
): Promise<z.infer<ResultSchema>> {
	const version = client.getServerVersion();

	try {
		log.debug(
			`Requesting ${method}:${identifier} from ${version?.name} (${version?.version})`,
		);
		return await client.request(request, resultSchema);
	} catch (error) {
		fail(
			`Request error with ${method}:${identifier} to ${version?.name} (${version?.version})`,
			ClientRequestError,
			error,
		);
	}
}

export function readRequestHandler<
	RequestSchema extends ZodObject<{
		method: ZodLiteral<string>;
		params: ZodObject<{
			name?: ZodLiteral<string> | z.ZodString;
			uri?: ZodLiteral<string> | z.ZodString;
		}>;
	}>,
	ResultSchema extends z.ZodType,
>(
	requestSchema: RequestSchema,
	resultSchema: ResultSchema,
): RequestHandler<RequestSchema> {
	return async (request: z.infer<typeof requestSchema>): Promise<Result> => {
		const method = request.method;
		const identifier = request.params.name || request.params.uri;
		const client = getClientFor(method, identifier as string);

		return await clientRequest(
			client,
			request,
			resultSchema,
			method,
			identifier,
		);
	};
}

export function listRequestHandler<
	RequestSchema extends ZodObject<{
		method: ZodLiteral<string>;
		params: ZodObject<{
			name?: ZodLiteral<string> | z.ZodString;
			uri?: ZodLiteral<string> | z.ZodString;
		}>;
	}>,
	ResultSchema extends z.ZodType,
	Key extends string = string,
	Item = unknown,
	Return = Item,
>(
	requestSchema: RequestSchema,
	resultSchema: ResultSchema,
	callback?: ListRequestHandlerCallback<ResultSchema, Key, Item, Return>,
): RequestHandler<RequestSchema> {
	return async (request: z.infer<typeof requestSchema>): Promise<Result> => {
		const method = request.method;
		const key = getKeyFor(method);
		const readMethod = getReadMethodFor(method);
		const clients = getAllClients();
		const results = (
			await Promise.allSettled(
				clients.map((client) =>
					clientRequest(client, request, resultSchema, method, key),
				),
			)
		).flatMap((result, index) => {
			log.debug(`Result for client ${index}:`, result);
			return result.status === "fulfilled"
				? Object.values(result.value).flatMap((items) =>
						Array.isArray(items)
							? items.map((item) => {
									setClientFor(readMethod, item.name, clients[index]);
									return callback ? callback(clients[index], item) : item;
								})
							: [],
					)
				: [];
		});

		return { [key]: results };
	};
}
