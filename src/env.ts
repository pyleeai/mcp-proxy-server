declare module "bun" {
	interface Env {
		CONFIGURATION_URL: string;
	}
}

const CONFIGURATION_URL = process.env.CONFIGURATION_URL;

export { CONFIGURATION_URL };
