import { cleanup } from "./cleanup";
import { logger } from "./logger";
import { server } from "./proxy";

using log = logger;

export const handleSIGINT = () => {
	return async () => {
		try {
			await cleanup();
		} catch (error) {
			log.error("Error during cleanup", error);
			process.exit(1);
		}
		try {
			await server.close();
			process.exit(0);
		} catch (error) {
			log.error("Error during server close", error);
			process.exit(1);
		}
	};
};

export const exitWithError = (reason: unknown) => {
	log.error("Exiting with error", reason);
	console.error("Exiting with error", reason);
	process.exit(1);
};
