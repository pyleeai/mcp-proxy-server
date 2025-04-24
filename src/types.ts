import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export type ServerConfiguration = {
	command?: string;
	args?: string[];
	env?: string[];
	url?: string;
};

export interface ServersConfiguration {
	servers: Record<string, ServerConfiguration>;
}

export interface MCPConfiguration {
	mcp: ServersConfiguration;
}

export interface Configuration extends MCPConfiguration {}

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
	transport: Transport | undefined;
};
