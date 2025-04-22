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

const requestCache: Record<string, Map<string, ClientState>> = {
	"tools/call": new Map(),
	"prompts/get": new Map(),
	"resources/read": new Map(),
};

export const setRequestCache = (
	method: string,
	key: string,
	state: ClientState,
): void => {
	let cache = method;

	switch (method) {
		case "prompts/list":
			cache = "prompts/get";
			break;
		case "tools/list":
			cache = "tools/call";
			break;
		case "resources/call":
			cache = "resources/read";
			break;
	}

	requestCache[cache]?.set(key, state);
};

export const getRequestCache = (method: string, key: string): ClientState => {
	const map = requestCache[method];
	const client = map?.get(key);

	if (!client) {
		throw new Error(`Client not found for ${method}:${key}`);
	}

	return client;
};
