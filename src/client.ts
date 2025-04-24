import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export const createClient = (): Client => {
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
