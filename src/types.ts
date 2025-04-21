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
