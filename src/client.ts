import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Server } from "./types";

export const createClient = (server: Server): Client => {
	const client = new Client(
		{
			name: "mcp-proxy-client",
			version: "1.0.0",
		},
		{
			capabilities: {
				prompts: {},
				resources: { subscribe: true },
				tools: {},
			},
		},
	);

	return client;
};
