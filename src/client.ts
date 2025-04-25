import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { name, version } from "../package.json" with { type: "json" };

export const createClient = (): Client => {
	const client = new Client(
		{
			name,
			version,
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
