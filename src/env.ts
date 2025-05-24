declare module "bun" {
	interface Env {
		CONFIGURATION_URL: string;
		CONFIGURATION_POLL_INTERVAL: string;
	}
}

const CONFIGURATION_URL = process.env.CONFIGURATION_URL;
const CONFIGURATION_POLL_INTERVAL = Number.parseInt(
	process.env.CONFIGURATION_POLL_INTERVAL || "0",
	10,
);

export { CONFIGURATION_URL, CONFIGURATION_POLL_INTERVAL };
