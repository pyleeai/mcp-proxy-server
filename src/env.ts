import { logger } from "./logger";

declare module "bun" {
	interface Env {
		CONFIGURATION_URL: string;
	}
}

using log = logger;

const CONFIGURATION_URL = process.env.CONFIGURATION_URL;

log.debug(`Configuration URL: ${CONFIGURATION_URL}`);

export { CONFIGURATION_URL };
