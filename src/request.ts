import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
	InitializeRequestSchema as ActualInitializeRequestSchema,
	InitializeResultSchema as ActualInitializeResultSchema,
	RequestSchema,
	ResultSchema,
	ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import pkg from "../package.json" with { type: "json" };
import {
	getAllClients,
	getClientFor,
	getKeyFor,
	getReadMethodFor,
	setClientFor,
} from "./data";
import { ClientRequestError } from "./errors";
import { logger } from "./logger";
import { fail, prefix } from "./utils";

using log = logger;

const { name, version } = pkg;

export const clientRequest = async (
	client: Client,
	request: z.infer<typeof RequestSchema>,
	resultSchema: typeof ResultSchema,
	method: string,
	identifier?: string | unknown | undefined,
): Promise<z.infer<typeof resultSchema>> => {
	const version = client.getServerVersion();

	try {
		log.debug(
			`Requesting ${method}:${identifier} from ${version?.name} (${version?.version})`,
		);
		return await client.request(request, resultSchema);
	} catch (error) {
		if (error instanceof McpError && error.code === ErrorCode.MethodNotFound) {
			log.warn(`Method ${method} not found in ${version?.name}`);
			return {};
		}
		if (error instanceof McpError && error.code === ErrorCode.RequestTimeout) {
			log.warn(`Method ${method} timed out in ${version?.name}`);
			return {};
		}

		return fail(
			`Request error with ${method}:${identifier} to ${version?.name} (${version?.version})`,
			ClientRequestError,
			error,
		);
	}
};

export const initializeRequestHandler = () => {
	return async (
		request: z.infer<typeof ActualInitializeRequestSchema>,
	): Promise<z.infer<typeof ActualInitializeResultSchema>> => {
		const capabilities: ServerCapabilities = {
			prompts: {},
			tools: {},
			resources: {},
		};
		const response = {
			serverInfo: {
				name,
				version,
			},
			protocolVersion: "2025-03-26",
			capabilities,
		};

		if (request.params.clientInfo) {
			log.info(
				`Received initialize request from client: ${request.params.clientInfo.name} (${request.params.clientInfo.version}) supporting MCP version ${request.params.clientInfo.mcpVersion}`,
			);
		} else {
			log.info("Received initialize request from an unknown client.");
		}

		log.debug(
			`Sending initialize response: ${JSON.stringify(response, null, 2)}`,
		);

		return response;
	};
};

export const readRequestHandler = (
	requestSchema: typeof RequestSchema,
	resultSchema: typeof ResultSchema,
) => {
	return async (
		request: z.infer<typeof requestSchema>,
	): Promise<z.infer<typeof resultSchema>> => {
		const method = request.method;
		const identifier = request.params?.name || request.params?.uri;
		const client = getClientFor(method, identifier as string);

		return await clientRequest(
			client,
			request,
			resultSchema,
			method,
			identifier,
		);
	};
};

export const listRequestHandler = (
	requestSchema: typeof RequestSchema,
	resultSchema: typeof ResultSchema,
) => {
	return async (
		request: z.infer<typeof requestSchema>,
	): Promise<z.infer<typeof resultSchema>> => {
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
			const client = clients[index];
			const { name } = client.getServerVersion() ?? { name: "Unknown" };
			return result.status === "fulfilled" && result.value !== undefined
				? Object.values(result.value ?? {}).flatMap((items) =>
						Array.isArray(items)
							? items
									.map((item) => prefix(`[${name}] `, item, "description"))
									.map((item) => {
										setClientFor(readMethod, item.name, client);
										return item;
									})
							: [],
					)
				: [];
		});

		return { [key]: results };
	};
};
