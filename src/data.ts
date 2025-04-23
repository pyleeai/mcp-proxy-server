import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { ClientState } from "./types";

const clientsStateMap = new Map<string, ClientState>();

export const setClientState = (name: string, state: ClientState): void => {
	clientsStateMap.set(name, state);
};

export const getAllClientStates = (): ClientState[] =>
	Array.from(clientsStateMap.values());

export const getAllClients = (): Client[] =>
	Array.from(clientsStateMap.values()).map((state) => state.client);

export const getKeyFor = (method: string): string => {
	switch (method) {
		case "prompts/list":
			return "prompts";
		case "tools/list":
			return "tools";
		case "resources/list":
			return "resources";
		case "resources/templates/list":
			return "resourceTemplates";
		default:
			return method;
	}
};

export const getReadMethodFor = (method: string): string => {
	switch (method) {
		case "prompts/list":
			return "prompts/get";
		case "tools/list":
			return "tools/call";
		case "resources/list":
			return "resources/read";
		default:
			return method;
	}
};

const proxyMap = new Map<string, Map<string, Client>>();

export const setClientFor = (
	method: string,
	identifier: string,
	client: Client,
): void => {
	const methodMap = proxyMap.get(method) || new Map();

	proxyMap.set(method, methodMap);
	methodMap.set(identifier, client);
};

export const getClientFor = (method: string, identifier: string): Client => {
	const methodMap = proxyMap.get(method);
	if (!methodMap) throw new Error(`No clients registered for method ${method}`);

	const client = methodMap.get(identifier);
	if (!client) throw new Error(`Client not found for ${method}:${identifier}`);

	return client;
};
