import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import pkg from "../package.json" with { type: "json" };

const { name, version } = pkg;

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
