import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import pkg from "../package.json" with { type: "json" };

const { name, version } = pkg;

export const createServer = () => {
	const server = new Server(
		{ name, version },
		{
			capabilities: { prompts: {}, resources: { subscribe: true }, tools: {} },
		},
	);

	return server;
};
