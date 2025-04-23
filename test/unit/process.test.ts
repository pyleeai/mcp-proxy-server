import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import * as cleanupModule from "../../src/cleanup";
import { handleSIGINT, exitWithError } from "../../src/process";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { logger } from "../../src/logger";

describe("process", () => {
	let mockCleanup: ReturnType<typeof spyOn>;
	let mockServer: {
		close: ReturnType<typeof mock>;
	};
	let processExitSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let loggerErrorSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockServer = {
			close: mock(() => Promise.resolve()),
		};
		mockCleanup = spyOn(cleanupModule, "cleanup").mockImplementation(() =>
			Promise.resolve(),
		);
		processExitSpy = spyOn(process, "exit").mockImplementation(
			() => undefined as never,
		);
		consoleErrorSpy = spyOn(console, "error").mockImplementation(
			() => undefined,
		);
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => undefined);
		loggerErrorSpy = spyOn(logger, "error");
	});

	afterEach(() => {
		mockCleanup.mockRestore();
		processExitSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleLogSpy.mockRestore();
		loggerErrorSpy.mockRestore();
	});

	describe("handleSIGINT", () => {
		test("should call cleanup and close server with successful exit", async () => {
			// Act
			const handler = handleSIGINT(mockServer as unknown as Server);
			await handler();

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServer.close).toHaveBeenCalledTimes(1);
			expect(processExitSpy).toHaveBeenCalledWith(0);
		});

		test("should handle error during cleanup", async () => {
			// Arrange
			const testError = new Error("Test cleanup error");
			mockCleanup.mockImplementation(() => Promise.reject(testError));

			// Act
			const handler = handleSIGINT(mockServer as unknown as Server);
			await handler();

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServer.close).toHaveBeenCalledTimes(1);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		test("should handle error during server close", async () => {
			// Arrange
			const testError = new Error("Test server close error");
			mockServer.close.mockImplementation(() => Promise.reject(testError));

			// Act
			const handler = handleSIGINT(mockServer as unknown as Server);
			await handler();

			// Assert
			expect(mockCleanup).toHaveBeenCalledTimes(1);
			expect(mockServer.close).toHaveBeenCalledTimes(1);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});
	});

	describe("exitWithError", () => {
		test("should log error and exit with code 1", () => {
			// Arrange
			const testError = new Error("Test error");

			// Act
			exitWithError(testError);

			// Assert
			expect(consoleLogSpy).not.toBeCalled();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Exiting with error",
				testError,
			);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				"Exiting with error",
				testError,
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		test("should handle non-Error objects", () => {
			// Arrange
			const errorObject = { message: "Not an actual Error object" };

			// Act
			exitWithError(errorObject);

			// Assert
			expect(consoleLogSpy).not.toBeCalled();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Exiting with error",
				errorObject,
			);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				"Exiting with error",
				errorObject,
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});
	});
});
