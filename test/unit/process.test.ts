import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as cleanupModule from "../../src/cleanup";
import { logger } from "../../src/logger";
import { exitWithError, handleSIGINT } from "../../src/process";
import * as proxyModule from "../../src/proxy";

describe("process", () => {
	let processExitSpy: ReturnType<typeof spyOn<typeof process, "exit">>;
	let consoleErrorSpy: ReturnType<typeof spyOn<typeof console, "error">>;
	let consoleLogSpy: ReturnType<typeof spyOn<typeof console, "log">>;
	let loggerErrorSpy: ReturnType<typeof spyOn<typeof logger, "error">>;

	beforeEach(() => {
		processExitSpy = spyOn(process, "exit").mockImplementation(
			() => undefined as never,
		);
		consoleErrorSpy = spyOn(console, "error").mockImplementation(() => "");
		consoleLogSpy = spyOn(console, "log").mockImplementation(() => "");
		loggerErrorSpy = spyOn(logger, "error").mockImplementation(() => "");
	});

	afterEach(() => {
		processExitSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleLogSpy.mockRestore();
		loggerErrorSpy.mockRestore();
	});

	describe("handleSIGINT", () => {
		let cleanupSpy: ReturnType<typeof spyOn<typeof cleanupModule, "cleanup">>;
		let serverCloseSpy:
			| ReturnType<typeof spyOn<typeof proxyModule.server, "close">>
			| undefined;

		beforeEach(() => {
			serverCloseSpy = undefined;
			cleanupSpy = spyOn(cleanupModule, "cleanup").mockResolvedValue(undefined);
			if (
				proxyModule.server &&
				typeof proxyModule.server.close === "function"
			) {
				serverCloseSpy = spyOn(proxyModule.server, "close").mockResolvedValue(
					undefined,
				);
			}
		});

		afterEach(() => {
			cleanupSpy?.mockRestore();
			serverCloseSpy?.mockRestore();
		});

		test("should call cleanup, close server, and exit successfully", async () => {
			// Arrange
			const handler = handleSIGINT();

			// Act
			await handler();

			// Assert
			expect(cleanupSpy).toHaveBeenCalledTimes(1);
			expect(serverCloseSpy).toHaveBeenCalledTimes(1);
			expect(processExitSpy).toHaveBeenCalledWith(0);
		});

		test("should log error and exit with failure if cleanup fails", async () => {
			// Arrange
			const testError = new Error("Cleanup error");
			cleanupSpy.mockRejectedValue(testError);
			const handler = handleSIGINT();

			// Act
			await handler();

			// Assert
			expect(cleanupSpy).toHaveBeenCalledTimes(1);
			expect(serverCloseSpy).toHaveBeenCalledTimes(1);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				"Error during cleanup",
				testError,
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});

		test("should log error and exit with failure if server close fails", async () => {
			// Arrange
			const testError = new Error("Server close error");
			serverCloseSpy?.mockRejectedValue(testError);
			const handler = handleSIGINT();

			// Act
			await handler();

			// Assert
			expect(cleanupSpy).toHaveBeenCalledTimes(1);
			expect(serverCloseSpy).toHaveBeenCalledTimes(1);
			expect(loggerErrorSpy).toHaveBeenCalledWith(
				"Error during server close",
				testError,
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);
		});
	});

	describe("exitWithError", () => {
		test("should log an Error object and exit with code 1", () => {
			// Arrange
			const testError = new Error("Test error");

			// Act
			exitWithError(testError);

			// Assert
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
	});
});
