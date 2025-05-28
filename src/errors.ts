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

export class ProxyError extends Error {
	constructor(
		message: string,
		public cause?: unknown,
	) {
		super(message, { cause });
		this.name = "ProxyError";
	}
}

export class AuthenticationError extends Error {
	constructor(
		message = "Authentication failed",
		public cause?: unknown,
	) {
		super(message, { cause });
		this.name = "AuthenticationError";
	}
}
