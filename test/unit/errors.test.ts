import { describe, expect, test } from "bun:test";
import {
	AuthenticationError,
	ClientRequestError,
	ConfigurationError,
	ProxyError,
} from "../../src/errors";

describe("ConfigurationError", () => {
	test("extends Error", () => {
		// Arrange
		const error = new ConfigurationError("test message");

		// Assert
		expect(error).toBeInstanceOf(Error);
	});

	test("sets correct name", () => {
		// Arrange
		const error = new ConfigurationError("test message");

		// Assert
		expect(error.name).toBe("ConfigurationError");
	});

	test("sets correct message", () => {
		// Arrange
		const message = "test configuration error message";
		const error = new ConfigurationError(message);

		// Assert
		expect(error.message).toBe(message);
	});

	test("handles cause parameter", () => {
		// Arrange
		const cause = new Error("original error");
		const error = new ConfigurationError("test message", cause);

		// Assert
		expect(error.cause).toBe(cause);
	});
});

describe("ClientRequestError", () => {
	test("extends Error", () => {
		// Arrange
		const error = new ClientRequestError("test message");

		// Assert
		expect(error).toBeInstanceOf(Error);
	});

	test("sets correct name", () => {
		// Arrange
		const error = new ClientRequestError("test message");

		// Assert
		expect(error.name).toBe("ClientRequestError");
	});

	test("sets correct message", () => {
		// Arrange
		const message = "test client request error message";
		const error = new ClientRequestError(message);

		// Assert
		expect(error.message).toBe(message);
	});

	test("handles cause parameter", () => {
		// Arrange
		const cause = new Error("original error");
		const error = new ClientRequestError("test message", cause);

		// Assert
		expect(error.cause).toBe(cause);
	});
});

describe("ProxyError", () => {
	test("extends Error", () => {
		// Arrange
		const error = new ProxyError("test message");

		// Assert
		expect(error).toBeInstanceOf(Error);
	});

	test("sets correct name", () => {
		// Arrange
		const error = new ProxyError("test message");

		// Assert
		expect(error.name).toBe("ProxyError");
	});

	test("sets correct message", () => {
		// Arrange
		const message = "test proxy error message";
		const error = new ProxyError(message);

		// Assert
		expect(error.message).toBe(message);
	});

	test("handles cause parameter", () => {
		// Arrange
		const cause = new Error("original error");
		const error = new ProxyError("test message", cause);

		// Assert
		expect(error.cause).toBe(cause);
	});
});

describe("AuthenticationError", () => {
	test("extends Error", () => {
		// Arrange
		const error = new AuthenticationError();

		// Assert
		expect(error).toBeInstanceOf(Error);
	});

	test("sets correct name", () => {
		// Arrange
		const error = new AuthenticationError();

		// Assert
		expect(error.name).toBe("AuthenticationError");
	});

	test("uses default message when no message provided", () => {
		// Arrange
		const error = new AuthenticationError();

		// Assert
		expect(error.message).toBe("Authentication failed");
	});

	test("sets custom message when provided", () => {
		// Arrange
		const message = "Custom authentication error message";
		const error = new AuthenticationError(message);

		// Assert
		expect(error.message).toBe(message);
	});

	test("handles cause parameter", () => {
		// Arrange
		const cause = new Error("original error");
		const error = new AuthenticationError("test message", cause);

		// Assert
		expect(error.cause).toBe(cause);
	});

	test("handles cause parameter with default message", () => {
		// Arrange
		const cause = new Error("original error");
		const error = new AuthenticationError(undefined, cause);

		// Assert
		expect(error.message).toBe("Authentication failed");
		expect(error.cause).toBe(cause);
	});
});
