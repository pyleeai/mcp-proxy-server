import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { cleanup } from "./cleanup";
import { connectClients } from "./clients";
import { configuration } from "./config";
import { ProxyError } from "./errors";
import { setRequestHandlers } from "./handlers";
import { logger } from "./logger";
import { createServer } from "./server";
import type { Configuration } from "./types";
import { fail } from "./utils";

using log = logger;

export const server = createServer();

export const proxy = async (
	configurationUrl?: string,
	options?: { headers?: Record<string, string> },
) => {
	log.info("MCP Proxy Server starting");

	let abortController: AbortController;
	let configPolling: Promise<void>;

	try {
		setRequestHandlers(server);

		const configGen = configuration(configurationUrl, options);
		abortController = new AbortController();
		
		let startupResolve!: () => void;
		let startupReject!: (error: any) => void;
		const startupPromise = new Promise<void>((resolve, reject) => {
			startupResolve = resolve;
			startupReject = reject;
		});
		
		let startupComplete = false;

		configPolling = (async () => {
			try {
				for await (const config of configGen) {
					if (abortController.signal.aborted) break;
					
					await connectClients(config);
					
					if (!startupComplete) {
						await server.connect(new StdioServerTransport());
						log.info("MCP Proxy Server started");
						startupComplete = true;
						startupResolve();
					} else {
						log.info("Configuration changed, reconnecting clients");
					}
				}
			} catch (error) {
				if (!startupComplete) {
					startupReject(error);
				} else if (!abortController.signal.aborted) {
					log.error("Error in configuration polling", error);
				}
			}
		})();
		
		await startupPromise;
		
	} catch (error) {
		fail("Failed to start MCP Proxy Server", ProxyError, error);
	}

	return {
		[Symbol.dispose]: async () => {
			abortController?.abort();
			await configPolling?.catch(() => {});
			await cleanup();
			await server.close();
		},
	};
};
