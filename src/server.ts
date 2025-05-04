import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { name, version } from "../package.json" with { type: "json" };

export const createServer = () => {
	const server = new Server(
		{ name, version },
		{
			capabilities: { prompts: {}, resources: { subscribe: true }, tools: {} },
		},
	);

	return server;
};
