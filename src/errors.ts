export class ConfigurationError extends Error {
	constructor(
		message: string,
		public cause?: unknown,
	) {
		super(message, { cause });
		this.name = "ConfigurationError";
	}
}

export class ClientRequestError extends Error {
	constructor(
		message: string,
		public cause?: unknown,
	) {
		super(message, { cause });
		this.name = "ClientRequestError";
	}
}
