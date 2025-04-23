import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { connectClients } from "./clients";
import { fetchConfiguration } from "./config";
import { setRequestHandlers } from "./handlers";
import { logger } from "./logger";

using log = logger;

export const proxy = async (server: Server) => {
	log.info("MCP Proxy Server starting");

	const config = await fetchConfiguration();
	const transport = new StdioServerTransport();

	setRequestHandlers(server);

	await connectClients(config);
	await server.connect(transport);

	log.info("MCP Proxy Server started");
};
