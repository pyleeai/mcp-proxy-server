import type { ClientState } from "./types";

const clientsStateMap = new Map<string, ClientState>();

export const setClientState = (name: string, state: ClientState): void => {
	clientsStateMap.set(name, state);
};

export const getAllClients = (): ClientState[] =>
	Array.from(clientsStateMap.values());
