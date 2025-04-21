import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { logger } from "../../src/logger";
import * as utils from "../../src/utils";

describe("delay", () => {
	test("properly waits for the specified time", async () => {
		// Arrange
		const waitTime = 50;

		// Act
		const start = Date.now();
		await utils.delay(waitTime);
		const elapsed = Date.now() - start;

		// Assert
		expect(elapsed).toBeGreaterThanOrEqual(waitTime - 10);
	});

	test("works in Bun environment", async () => {
		// Arrange & Assert
		expect(process.versions.bun).toBeDefined();
		expect(utils.delay).toBeDefined();

		// Act - Verify it can be called with no errors
		await utils.delay(1);
	});
});

describe("fail", () => {
	let loggerErrorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		loggerErrorSpy = spyOn(logger, "error");
	});

	afterEach(() => {
		loggerErrorSpy.mockRestore();
	});

	test("throws an error with Error class when no custom error class is provided", () => {
		// Arrange
		const errorMessage = "Test error message";

		// Act & Assert
		expect(() => utils.fail(errorMessage)).toThrow(Error);
		expect(() => utils.fail(errorMessage)).toThrow(errorMessage);
		expect(loggerErrorSpy).toHaveBeenCalledWith(errorMessage);
	});

	test("throws a custom error class when provided", () => {
		// Arrange
		class CustomError extends Error {}
		const errorMessage = "Custom error message";

		// Act & Assert
		expect(() => utils.fail(errorMessage, CustomError)).toThrow(CustomError);
		expect(() => utils.fail(errorMessage, CustomError)).toThrow(errorMessage);
		expect(loggerErrorSpy).toHaveBeenCalledWith(errorMessage);
	});

	test("includes cause in error message when cause is an Error", () => {
		// Arrange
		const errorMessage = "Parent error";
		const causeError = new Error("Cause error");

		// Act & Assert
		expect(() => utils.fail(errorMessage, Error, causeError)).toThrow(
			`${errorMessage}: ${causeError.message}`,
		);
		expect(loggerErrorSpy).toHaveBeenCalledWith(errorMessage, causeError);
	});

	test("includes string representation of cause when cause is not an Error", () => {
		// Arrange
		const errorMessage = "Failed with object cause";
		const cause = { message: "Object cause" };

		// Act & Assert
		expect(() => utils.fail(errorMessage, Error, cause)).toThrow(
			`${errorMessage}: ${String(cause)}`,
		);
		expect(loggerErrorSpy).toHaveBeenCalledWith(
			`${errorMessage}: ${String(cause)}`,
		);
	});
});
