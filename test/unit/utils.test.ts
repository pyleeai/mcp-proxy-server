import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { logger } from "../../src/logger";
import * as utils from "../../src/utils";
import { prefix, sleep } from "../../src/utils";

describe("sleep", () => {
	test("properly waits for the specified time", async () => {
		// Arrange
		const waitTime = 100;
		const start = Date.now();

		// Act
		await sleep(waitTime);
		const elapsed = Date.now() - start;

		// Assert
		expect(elapsed).toBeGreaterThanOrEqual(waitTime - 10); // Allow for small timing variance
	});

	test("resolves to undefined", async () => {
		// Act & Assert
		await expect(sleep(1)).resolves.toBeUndefined();
	});

	test("can handle zero milliseconds", async () => {
		// Act & Assert
		await expect(sleep(0)).resolves.toBeUndefined();
	});
});

describe("delay", () => {
	test("properly waits for the specified time", async () => {
		// Arrange
		const waitTime = 100;
		const sleepPromise = utils.delay(waitTime);

		// Act & Assert
		expect(sleepPromise).resolves.toBeUndefined();
	});

	test("works in Bun environment", async () => {
		// Arrange & Assert
		expect(process.versions.bun).toBeDefined();
		expect(utils.delay).toBeDefined();

		// Act - Verify it can be called with no errors
		await utils.delay(1);
	});

	test("can handle zero milliseconds", async () => {
		// Act & Assert
		await expect(utils.delay(0)).resolves.toBeUndefined();
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

describe("retry", () => {
	let loggerWarnSpy: ReturnType<typeof spyOn>;
	let delaySpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		loggerWarnSpy = spyOn(logger, "warn");
		delaySpy = spyOn(utils, "delay").mockImplementation(async () =>
			Promise.resolve(),
		);
	});

	afterEach(() => {
		loggerWarnSpy.mockRestore();
		delaySpy.mockRestore();
	});

	test("returns the result when the function succeeds on first attempt", async () => {
		// Arrange
		const expectedValue = { success: true };
		const testFn = () => expectedValue;

		// Act
		const result = await utils.retry(testFn);

		// Assert
		expect(result).toEqual(expectedValue);
		expect(delaySpy).not.toHaveBeenCalled();
	});

	test("retries and returns the result when function eventually succeeds", async () => {
		// Arrange
		const expectedValue = { success: true };
		let attempts = 0;
		const testFn = () => {
			if (attempts++ < 2) {
				throw new Error(`Failed attempt ${attempts}`);
			}
			return expectedValue;
		};

		// Act
		const result = await utils.retry(testFn);

		// Assert
		expect(result).toEqual(expectedValue);
		expect(attempts).toBe(3);
		expect(loggerWarnSpy).toHaveBeenCalledTimes(2);
		expect(delaySpy).toHaveBeenCalledTimes(2);
		expect(delaySpy).toHaveBeenNthCalledWith(1, 1000);
		expect(delaySpy).toHaveBeenNthCalledWith(2, 2000);
	});

	test("retries the maximum number of times before returning the fallback value", async () => {
		// Arrange
		type TestResult = { fallback: boolean };
		const fallbackValue: TestResult = { fallback: true };
		let attempts = 0;
		const testFn = (): TestResult => {
			attempts++;
			throw new Error("Always fails");
		};
		const options = {
			maxRetries: 3,
			fallbackValue,
		};

		// Act
		const result = await utils.retry(testFn, options);

		// Assert
		expect(result).toEqual(fallbackValue);
		expect(attempts).toBe(4);
		expect(loggerWarnSpy).toHaveBeenCalledTimes(4);
		expect(delaySpy).toHaveBeenCalledTimes(3);
	});

	test("returns immediately when maxRetries is 0", async () => {
		// Arrange
		type TestResult = { immediate: boolean };
		const fallbackValue: TestResult = { immediate: true };
		let attempts = 0;
		const testFn = (): TestResult => {
			attempts++;
			throw new Error("Always fails");
		};
		const options = {
			maxRetries: 0,
			fallbackValue,
		};

		// Act
		const result = await utils.retry<TestResult>(testFn, options);

		// Assert
		expect(result).toEqual(fallbackValue);
		expect(attempts).toBe(1);
		expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
		expect(delaySpy).not.toHaveBeenCalled();
	});

	test("uses custom retry options correctly", async () => {
		// Arrange
		let attempts = 0;
		const testFn = () => {
			attempts++;
			throw new Error("Always fails");
		};
		const options = {
			maxRetries: 2,
			initialDelay: 500,
			backoffFactor: 3,
			maxDelay: 5000,
		};

		// Act
		const result = await utils.retry(testFn, options);

		// Assert
		expect(result).toBeUndefined();
		expect(attempts).toBe(3);
		expect(loggerWarnSpy).toHaveBeenCalledTimes(3);
		expect(delaySpy).toHaveBeenCalledTimes(2);
		expect(delaySpy).toHaveBeenNthCalledWith(1, 500);
		expect(delaySpy).toHaveBeenNthCalledWith(2, 1500);
	});

	test("respects the maxDelay option", async () => {
		// Arrange
		let attempts = 0;
		const testFn = () => {
			attempts++;
			throw new Error("Always fails");
		};
		const options = {
			maxRetries: 2,
			initialDelay: 2000,
			backoffFactor: 10,
			maxDelay: 5000,
		};

		// Act
		await utils.retry(testFn, options);

		// Assert
		expect(delaySpy).toHaveBeenNthCalledWith(1, 2000);
		expect(delaySpy).toHaveBeenNthCalledWith(2, 5000);
	});

	test("handles Promise rejection correctly", async () => {
		// Arrange
		let attempts = 0;
		const testFn = async () => {
			attempts++;
			return Promise.reject(new Error("Promise rejection"));
		};

		// Act
		const result = await utils.retry(testFn);

		// Assert
		expect(result).toBeUndefined();
		expect(attempts).toBe(4);
		expect(loggerWarnSpy).toHaveBeenCalledTimes(4);
		expect(loggerWarnSpy).toHaveBeenLastCalledWith(
			"All 3 retry attempts failed, returning undefined",
			expect.any(Error),
		);
	});
});

describe("prefix", () => {
	test("should prefix a string", () => {
		const result = prefix("TEST", "hello");
		expect(result).toBe("TESThello");
	});

	test("should handle undefined string values", () => {
		const result = prefix("TEST", undefined);
		expect(result).toBe("TEST");
	});

	test("should handle empty string values", () => {
		const result = prefix("TEST", "");
		expect(result).toBe("TEST");
	});

	test("should prefix a specific field in an object", () => {
		const obj = { name: "John", message: "Hello World" };
		const result = prefix("TEST", obj, "message");

		expect(result).toEqual({
			name: "John",
			message: "TESTHello World",
		});
	});

	test("should handle undefined field in an object", () => {
		const obj = { name: "John" };
		type ObjWithMessage = { name: string; message: string };
		const result = prefix("TEST", obj as unknown as ObjWithMessage, "message");

		expect(result).toEqual({
			name: "John",
			message: "TEST",
		});
	});

	test("should not modify the original object", () => {
		const obj = { name: "John", message: "Hello World" };
		prefix("TEST", obj, "message");

		expect(obj).toEqual({ name: "John", message: "Hello World" });
	});

	test("should handle non-string field types in an object", () => {
		const obj = { name: "John", count: 42 };
		const result = prefix("TEST", obj, "count");

		expect(result).toEqual({
			name: "John",
			count: "TEST42",
		} as typeof obj & { count: string });
	});

	test("should handle null values", () => {
		const obj = { name: "John", message: null as null };
		const result = prefix("TEST", obj, "message");

		expect(result).toEqual({
			name: "John",
			message: "TEST",
		} as typeof obj & { message: string });
	});

	test("should use empty prefix if empty string provided", () => {
		const result = prefix("", "hello");
		expect(result).toBe("hello");
	});

	test("should handle complex object prefixing", () => {
		// Arrange
		const complexObj = {
			id: 123,
			names: ["John", "Jane"],
			details: {
				address: "123 Main St",
			},
		};

		// Act
		const result = prefix("PREFIX_", complexObj, "id");

		// Assert
		expect(result).toEqual({
			...complexObj,
			id: "PREFIX_123",
		} as typeof complexObj & { id: string });
	});
});
