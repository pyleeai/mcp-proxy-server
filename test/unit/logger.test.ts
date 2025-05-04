import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	setSystemTime,
	spyOn,
	test,
} from "bun:test";
import * as fs from "node:fs";
import { dirname } from "node:path";
import {
	convertUnknownToString,
	debug,
	error,
	info,
	log,
	logMessage,
	logMessages,
	logger,
	warn,
} from "../../src/logger";

describe("logger coverage test", () => {
	const fixedTestDate = new Date("2025-01-01T12:00:00.000Z");
	const fixedTimestamp = fixedTestDate.toISOString();
	const testLogPath = "/path/to/log.txt";
	const testLogDir = dirname(testLogPath);
	let originalProcessEnv: NodeJS.ProcessEnv;
	let mockMkdirSync: ReturnType<typeof spyOn>;
	let mockAppendFileSync: ReturnType<typeof spyOn>;
	let mockConsoleError: ReturnType<typeof spyOn>;

	beforeAll(() => {});

	beforeEach(() => {
		setSystemTime(fixedTestDate);
		originalProcessEnv = { ...process.env };
		process.env.NODE_ENV = "test";
		process.env.LOG_PATH = testLogPath;
		mockConsoleError = spyOn(console, "error").mockImplementation(() => "");
		mockMkdirSync = spyOn(fs, "mkdirSync").mockImplementation(
			// Ensure return type matches: string | undefined
			() => undefined,
		);
		mockAppendFileSync = spyOn(fs, "appendFileSync").mockImplementation(
			() => {},
		);
	});

	afterEach(() => {
		setSystemTime();
		mockMkdirSync.mockRestore();
		mockAppendFileSync.mockRestore();
		mockConsoleError.mockRestore();
		process.env = originalProcessEnv;
	});

	describe("convertUnknownToString", () => {
		test("handles primitive types correctly", () => {
			// Act & Assert
			expect(convertUnknownToString(null)).toBe("null");
			expect(convertUnknownToString(undefined)).toBe("undefined");
			expect(convertUnknownToString("test string")).toBe("test string");
			expect(convertUnknownToString("")).toBe("");
			expect(convertUnknownToString(42)).toBe("42");
			expect(convertUnknownToString(Math.PI)).toBe("3.141592653589793");
			expect(convertUnknownToString(Number.NaN)).toBe("null");
			expect(convertUnknownToString(Number.POSITIVE_INFINITY)).toBe("null");
			expect(convertUnknownToString(true)).toBe("true");
			expect(convertUnknownToString(false)).toBe("false");
		});

		test("handles symbol values", () => {
			// Arrange
			const testSymbol = Symbol("test-symbol");

			// Act
			const result = convertUnknownToString(testSymbol);

			// Assert
			expect(result).toBe("Symbol(test-symbol)");
		});

		test("handles errors with and without stack traces", () => {
			// Arrange
			const errorWithStack = new Error("test error");
			const customStack =
				"Error: test error\n    at Object.<anonymous> (test.ts:1:1)";
			errorWithStack.stack = customStack;
			const errorWithoutStack = new Error("stackless error");
			errorWithoutStack.stack = undefined;

			// Act
			const errorWithStackResult = convertUnknownToString(errorWithStack);
			const errorWithoutStackResult = convertUnknownToString(errorWithoutStack);

			// Assert
			const expectedStackOutput = `Error: test error\n${customStack}`;
			expect(errorWithStackResult).toBe(expectedStackOutput);
			expect(errorWithoutStackResult).toBe("Error: stackless error");
		});

		test("handles JSON-serializable objects and arrays", () => {
			// Act & Assert
			expect(convertUnknownToString({ foo: "bar" })).toBe('{"foo":"bar"}');
			expect(convertUnknownToString([1, 2])).toBe("[1,2]");
			expect(convertUnknownToString([])).toBe("[]");
		});

		test("handles functions", () => {
			// Arrange
			const testFn = () => "test";

			// Act
			const result = convertUnknownToString(testFn);

			// Assert
			expect(result).toBe("{}");
		});

		test("safely handles objects that cause JSON.stringify to throw", () => {
			// Arrange
			const circularObj: { self?: unknown } = {};
			circularObj.self = circularObj;

			// Act & Assert
			expect(convertUnknownToString(circularObj)).toBe("[Complex Object]");
			expect(convertUnknownToString(BigInt(1))).toBe("[Complex Object]");
			expect(convertUnknownToString(new Map())).toBe("[Complex Object]");
			expect(convertUnknownToString(new Set())).toBe("[Complex Object]");
		});
	});

	describe("logMessage", () => {
		test("formats a string message with timestamp and level", () => {
			// Arrange
			const message = "Test log message";
			const level = "DEBUG";
			const expected = `${fixedTimestamp} [${level}] ${message}\n`;

			// Act
			const result = logMessage(level, message);

			// Assert
			expect(result).toBe(expected);
		});

		test("formats an object message as JSON with timestamp and level", () => {
			// Arrange
			const obj = { key: "value" };
			const level = "INFO";
			const expected = `${fixedTimestamp} [${level}] ${JSON.stringify(obj)}\n`;

			// Act
			const result = logMessage(level, obj);

			// Assert
			expect(result).toBe(expected);
		});

		test("formats an error message with stack trace", () => {
			// Arrange
			const err = new Error("fail!");
			const customStack = "Error: fail!\n    at test.ts:1:1";
			err.stack = customStack;
			const level = "ERROR";
			const expectedMessageContent = `Error: fail!\n${customStack}`;
			const expected = `${fixedTimestamp} [${level}] ${expectedMessageContent}\n`;

			// Act
			const result = logMessage(level, err);

			// Assert
			expect(result).toContain(`[${level}]`);
			expect(result).toContain(fixedTimestamp);
			expect(result).toContain("Error: fail!");
			expect(result).toContain("at test.ts:1:1");
			expect(result).toBe(expected);
		});
	});

	describe("logMessages", () => {
		test("formats a single message correctly", () => {
			// Arrange
			const testMsg = "Test message";
			const expected = `${fixedTimestamp} [DEBUG] ${testMsg}\n`;

			// Act
			const result = logMessages("DEBUG", [testMsg]);

			// Assert
			expect(result).toBe(expected);
		});

		test("joins multiple messages correctly (each on a new line)", () => {
			// Arrange
			const messages = ["Message 1", "Message 2"];
			const expected = `${fixedTimestamp} [INFO] Message 1\n ${fixedTimestamp} [INFO] Message 2\n`;

			// Act
			const result = logMessages("INFO", messages);

			// Assert
			expect(result).toBe(expected);
		});

		test("handles different types of messages correctly", () => {
			// Arrange
			const errorObj = new Error("fail!");
			const customStack = "Error: fail!\n    at test.ts:1:1";
			errorObj.stack = customStack;
			const plainObject = { foo: "bar", count: 5 };
			const symbolValue = Symbol("test-symbol");
			const circularObj: { self?: unknown } = {};
			circularObj.self = circularObj;
			const messages: unknown[] = [
				"Simple String",
				errorObj,
				plainObject,
				undefined,
				null,
				symbolValue,
				circularObj,
			];
			const expectedErrorContent = `Error: fail!\n${customStack}`;
			const expectedLines = [
				`${fixedTimestamp} [WARN] Simple String`,
				`${fixedTimestamp} [WARN] ${expectedErrorContent}`,
				`${fixedTimestamp} [WARN] ${JSON.stringify(plainObject)}`,
				`${fixedTimestamp} [WARN] undefined`,
				`${fixedTimestamp} [WARN] null`,
				`${fixedTimestamp} [WARN] Symbol(test-symbol)`,
				`${fixedTimestamp} [WARN] [Complex Object]`,
			];
			const expected = `${expectedLines.join("\n ")}\n`;

			// Act
			const result = logMessages("WARN", messages);

			// Assert
			expect(result).toBe(expected);
		});

		test("handles an empty messages array", () => {
			// Arrange & Act
			const result = logMessages("INFO", []);

			// Assert
			expect(result).toBe("");
		});
	});

	describe("log function", () => {
		test("writes to log file when LOG_PATH is set", () => {
			// Arrange
			const testMessage = "test message";
			const expectedLogContent = `${fixedTimestamp} [INFO] ${testMessage}\n`;

			// Act
			const result = log("INFO", testMessage);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});

		test("does not write to log file when LOG_PATH is not set", () => {
			// Arrange
			process.env.LOG_PATH = undefined;
			const testMessage = "test message";
			const expectedLogContent = `${fixedTimestamp} [INFO] ${testMessage}\n`;

			// Act
			const result = log("INFO", testMessage);

			// Assert
			expect(mockMkdirSync).not.toHaveBeenCalled();
			expect(mockAppendFileSync).not.toHaveBeenCalled();
			expect(result).toBe(expectedLogContent);
		});

		test("logs internal error via console.error when writing to file fails", () => {
			// Arrange
			const fileWriteError = new Error("Failed to create directory");
			mockMkdirSync.mockImplementationOnce(() => {
				throw fileWriteError;
			});
			const testMessage = "test message";
			const expectedLogContent = `${fixedTimestamp} [INFO] ${testMessage}\n`;

			// Act
			const result = log("INFO", testMessage);

			// Assert
			expect(mockConsoleError).toHaveBeenCalledTimes(1);
			expect(result).toBe(expectedLogContent);
			expect(mockAppendFileSync).not.toHaveBeenCalled();
		});

		test("handles multiple messages by logging each on a new line", () => {
			// Arrange
			const msg1 = "message 1";
			const msg2 = "message 2";
			const obj = { key: "value" };
			const expectedLogContent = `${fixedTimestamp} [INFO] ${msg1}\n ${fixedTimestamp} [INFO] ${msg2}\n ${fixedTimestamp} [INFO] ${JSON.stringify(obj)}\n`;

			// Act
			const result = log("INFO", msg1, msg2, obj);

			// Assert
			expect(mockAppendFileSync).toHaveBeenCalledTimes(1);
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});
	});

	describe("helper log functions", () => {
		test("debug function calls log with DEBUG level", () => {
			// Arrange
			const testMessage = "debug message";
			const testObject = { key: "value" };
			const expectedLogContent = `${fixedTimestamp} [DEBUG] ${testMessage}\n ${fixedTimestamp} [DEBUG] ${JSON.stringify(testObject)}\n`;

			// Act
			const result = debug(testMessage, testObject);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});

		test("info function calls log with INFO level", () => {
			// Arrange
			const testMessage = "info message";
			const expectedLogContent = `${fixedTimestamp} [INFO] ${testMessage}\n`;

			// Act
			const result = info(testMessage);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});

		test("warn function calls log with WARN level", () => {
			// Arrange
			const testMessage = "warning message";
			const expectedLogContent = `${fixedTimestamp} [WARN] ${testMessage}\n`;

			// Act
			const result = warn(testMessage);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});

		test("error function calls log with ERROR level", () => {
			// Arrange
			const testError = new Error("Something went wrong");
			const customStack = "Error: Something went wrong\n    at test.ts:1:1";
			testError.stack = customStack;
			const expectedErrorContent = `Error: Something went wrong\n${customStack}`;
			const expectedLogContent = `${fixedTimestamp} [ERROR] ${expectedErrorContent}\n`;

			// Act
			const result = error(testError);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});

		test("debug handles multiple arguments", () => {
			// Arrange
			const debugMsg1 = "message 1";
			const debugMsg2 = "message 2";
			const debugObj = { debug: true };
			const expectedLogContent = `${fixedTimestamp} [DEBUG] ${debugMsg1}\n ${fixedTimestamp} [DEBUG] ${debugMsg2}\n ${fixedTimestamp} [DEBUG] ${JSON.stringify(debugObj)}\n`;

			// Act
			const result = debug(debugMsg1, debugMsg2, debugObj);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});

		test("info handles multiple arguments", () => {
			// Arrange
			const infoMsg1 = "message 1";
			const infoMsg2 = "message 2";
			const infoObj = { info: true };
			const expectedLogContent = `${fixedTimestamp} [INFO] ${infoMsg1}\n ${fixedTimestamp} [INFO] ${infoMsg2}\n ${fixedTimestamp} [INFO] ${JSON.stringify(infoObj)}\n`;

			// Act
			const result = info(infoMsg1, infoMsg2, infoObj);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});

		test("warn handles multiple arguments", () => {
			// Arrange
			const warnMsg1 = "message 1";
			const warnMsg2 = "message 2";
			const warnObj = { warn: true };
			const expectedLogContent = `${fixedTimestamp} [WARN] ${warnMsg1}\n ${fixedTimestamp} [WARN] ${warnMsg2}\n ${fixedTimestamp} [WARN] ${JSON.stringify(warnObj)}\n`;

			// Act
			const result = warn(warnMsg1, warnMsg2, warnObj);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});

		test("error handles multiple arguments", () => {
			// Arrange
			const errorStr = "Error string";
			const errorObj = { error: true };
			const expectedLogContent = `${fixedTimestamp} [ERROR] ${errorStr}\n ${fixedTimestamp} [ERROR] ${JSON.stringify(errorObj)}\n`;

			// Act
			const result = error(errorStr, errorObj);

			// Assert
			expect(mockMkdirSync).toHaveBeenCalledWith(testLogDir, {
				recursive: true,
			});
			expect(mockAppendFileSync).toHaveBeenCalledWith(
				testLogPath,
				expectedLogContent,
				"utf8",
			);
			expect(result).toBe(expectedLogContent);
		});
	});

	describe("logger", () => {
		test("Symbol.dispose is implemented and is a no-op function", () => {
			// Assert
			expect(typeof logger[Symbol.dispose]).toBe("function");
			expect(() => logger[Symbol.dispose]()).not.toThrow();
			expect(logger[Symbol.dispose]()).toBeUndefined();
		});

		test("logger can be used with 'using' declaration", () => {
			// Arrange
			const testUsingBlock = () => {
				using log = logger;
				log.info("Testing resource management pattern");
			};

			// Act & Assert
			expect(() => testUsingBlock()).not.toThrow();
		});

		test("exports expected methods and Symbol.dispose", () => {
			// Assert
			expect(typeof logger.log).toBe("function");
			expect(typeof logger.debug).toBe("function");
			expect(typeof logger.info).toBe("function");
			expect(typeof logger.warn).toBe("function");
			expect(typeof logger.error).toBe("function");
			expect(typeof logger[Symbol.dispose]).toBe("function");
		});
	});
});
