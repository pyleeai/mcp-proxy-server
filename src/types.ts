import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export type Server = {
	command?: string;
	args?: string[];
	env?: string[];
	url?: string;
};

export interface Servers {
	mcpServers: Record<string, Server>;
}

export interface Configuration extends Servers {}

export interface RetryOptions {
	initialDelay?: number;
	maxDelay?: number;
	maxRetries?: number;
	backoffFactor?: number;
	fallbackValue?: unknown;
}

export type ClientState = {
	name: string;
	client: Client;
	transport: Promise<Transport | undefined>;
};

export interface ListRequestHandlerConfig<R extends object> {
	method: string;
	param: string;
	key: keyof R;
}

export type ListRequestHandlerCallback = (
	client: ClientState,
	item: unknown,
) => unknown;
