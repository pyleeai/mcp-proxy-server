import {
	afterEach,
	beforeAll,
	describe,
	expect,
	setSystemTime,
	test,
} from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";

const logPath = process.env.LOG_PATH as string;
const fixedTestDate = new Date("2025-01-01T12:00:00.000Z");

beforeAll(() => {
	setSystemTime(fixedTestDate);
});

afterEach(() => {
	rmSync(dirname(logPath), { recursive: true, force: true });
});

describe("logger", () => {
	test("log methods write correctly formatted messages", async () => {
		// Arrange
		const { logger } = await import("../../src/logger");

		// Act
		logger.log("LOG", "Log message");
		logger.debug("Debug message");
		logger.info("Info message");
		logger.warn("Warning message");
		logger.error("Error message");

		// Assert
		const logContent = readFileSync(logPath, "utf8");
		expect(logContent).toContain(
			`${fixedTestDate.toISOString()} [DEBUG] Debug message`,
		);
		expect(logContent).toContain(
			`${fixedTestDate.toISOString()} [INFO] Info message`,
		);
		expect(logContent).toContain(
			`${fixedTestDate.toISOString()} [WARN] Warning message`,
		);
		expect(logContent).toContain(
			`${fixedTestDate.toISOString()} [ERROR] Error message`,
		);
	});

	test("handles extra messages of all kinds", async () => {
		// Arrange
		const { logger } = await import("../../src/logger");
		const error = new Error("fail!");
		const object = { foo: "bar", count: 5 };
		const undefinedValue = undefined;
		const nullValue = null;
		const symbolValue = Symbol("test-symbol");
		type CircularType = { self?: CircularType };
		const circularObj: CircularType = {};
		circularObj.self = circularObj;

		// Act
		logger.log(
			"String",
			error,
			object,
			undefinedValue,
			nullValue,
			symbolValue,
			circularObj,
		);

		// Assert
		const logContent = readFileSync(logPath, "utf8");
		expect(logContent).toContain("String");
		expect(logContent).toContain("Error: fail!");
		expect(logContent).toContain(error.stack?.split("\n")[0]);
		expect(logContent).toContain(JSON.stringify(object));
		expect(logContent).toContain("undefined");
		expect(logContent).toContain("null");
		expect(logContent).toContain("Symbol(test-symbol)");
		expect(logContent).not.toContain("[object Object]");
	});
});
