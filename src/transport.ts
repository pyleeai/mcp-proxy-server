import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { logger } from "./logger";
import type { Server } from "./types";

using log = logger;

export const createHTTPTransport = (server: Server): Transport => {
	const url = new URL(server.url as string);

	log.debug(`Creating HTTP transport for ${url}`);

	return new StreamableHTTPClientTransport(url);
};

export const createSSETransport = (server: Server): Transport => {
	const url = new URL(server.url as string);

	log.debug(`Creating SSE transport for ${url}`);

	return new SSEClientTransport(url);
};

export const createStdioTransport = (server: Server): Transport => {
	if (!server.command) {
		throw new Error("Server command is missing");
	}

	const command = server.command;
	const args = server.args as string[];
	const env: Record<string, string> = {
		...((server.env ?? {}) as Record<string, string>),
	};

	if (!("PATH" in env)) {
		env.PATH = process.env.PATH || "";
	}

	log.debug(
		`Creating Stdio transport using ${server.command} ${server.args?.join(" ")}`,
	);

	return new StdioClientTransport({ command, args, env });
};
