import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { connectClients } from "./clients";
import { fetchConfiguration } from "./config";
import { ProxyError } from "./errors";
import { setRequestHandlers } from "./handlers";
import { logger } from "./logger";
import { createServer } from "./server";
import { fail } from "./utils";

using log = logger;

export const server = createServer();

export const proxy = async () => {
	log.info("MCP Proxy Server starting");

	try {
		const config = await fetchConfiguration();
		const transport = new StdioServerTransport();

		setRequestHandlers(server);

		await connectClients(config);
		await server.connect(transport);
	} catch (error) {
		fail("Failed to start MCP Proxy Server", ProxyError, error);
	}

	log.info("MCP Proxy Server started");
};
