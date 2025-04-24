import { Server } from "@modelcontextprotocol/sdk/server/index.js";

export const createServer = () => {
	const server = new Server(
		{ name: "mcp-proxy-server", version: "1.0.0" },
		{
			capabilities: { prompts: {}, resources: { subscribe: true }, tools: {} },
		},
	);

	return server;
};
