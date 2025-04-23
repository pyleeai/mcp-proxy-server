#!/usr/bin/env bun

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { connectClients } from "./clients";
import { fetchConfiguration } from "./config";
import { logger } from "./logger";
import { createServer } from "./server";
import { cleanup } from "./cleanup";
import { setRequestHandlers } from "./handlers";

using log = logger;

export const proxy = async () => {
	const config = await fetchConfiguration();
	const server = createServer();
	const transport = new StdioServerTransport();

	setRequestHandlers(server);

	await server.connect(transport);

	connectClients(config);

	process.on("SIGINT", async () => {
		await cleanup();
		await server.close();

		process.exit(0);
	});
};
