import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { logger } from "../../src/logger";
import {
	sendAllListChangedNotifications,
	sendPromptListChanged,
	sendResourceListChanged,
	sendToolListChanged,
} from "../../src/notifications";

interface MockServer
	extends Pick<
		Server,
		"sendResourceListChanged" | "sendToolListChanged" | "sendPromptListChanged"
	> {
	sendResourceListChanged: ReturnType<typeof mock>;
	sendToolListChanged: ReturnType<typeof mock>;
	sendPromptListChanged: ReturnType<typeof mock>;
}

describe("notifications", () => {
	let mockServer: MockServer;
	let loggerDebugSpy: ReturnType<typeof spyOn>;
	let loggerWarnSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockServer = {
			sendResourceListChanged: mock(async () => {}),
			sendToolListChanged: mock(async () => {}),
			sendPromptListChanged: mock(async () => {}),
		};

		loggerDebugSpy = spyOn(logger, "debug");
		loggerWarnSpy = spyOn(logger, "warn");
	});

	afterEach(() => {
		loggerDebugSpy.mockRestore();
		loggerWarnSpy.mockRestore();
	});

	describe("sendResourceListChanged", () => {
		test("should call server.sendResourceListChanged successfully", async () => {
			// Act
			await sendResourceListChanged(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendResourceListChanged).toHaveBeenCalledTimes(1);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Sent resource list changed notification",
			);
			expect(loggerWarnSpy).not.toHaveBeenCalled();
		});

		test("should handle errors gracefully", async () => {
			// Arrange
			const error = new Error("Server error");
			mockServer.sendResourceListChanged = mock(async () => {
				throw error;
			});

			// Act
			await sendResourceListChanged(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendResourceListChanged).toHaveBeenCalledTimes(1);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				"Failed to send resource list changed notification",
				error,
			);
			expect(loggerDebugSpy).not.toHaveBeenCalled();
		});
	});

	describe("sendToolListChanged", () => {
		test("should call server.sendToolListChanged successfully", async () => {
			// Act
			await sendToolListChanged(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendToolListChanged).toHaveBeenCalledTimes(1);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Sent tool list changed notification",
			);
			expect(loggerWarnSpy).not.toHaveBeenCalled();
		});

		test("should handle errors gracefully", async () => {
			// Arrange
			const error = new Error("Server error");
			mockServer.sendToolListChanged = mock(async () => {
				throw error;
			});

			// Act
			await sendToolListChanged(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendToolListChanged).toHaveBeenCalledTimes(1);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				"Failed to send tool list changed notification",
				error,
			);
			expect(loggerDebugSpy).not.toHaveBeenCalled();
		});
	});

	describe("sendPromptListChanged", () => {
		test("should call server.sendPromptListChanged successfully", async () => {
			// Act
			await sendPromptListChanged(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendPromptListChanged).toHaveBeenCalledTimes(1);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Sent prompt list changed notification",
			);
			expect(loggerWarnSpy).not.toHaveBeenCalled();
		});

		test("should handle errors gracefully", async () => {
			// Arrange
			const error = new Error("Server error");
			mockServer.sendPromptListChanged = mock(async () => {
				throw error;
			});

			// Act
			await sendPromptListChanged(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendPromptListChanged).toHaveBeenCalledTimes(1);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				"Failed to send prompt list changed notification",
				error,
			);
			expect(loggerDebugSpy).not.toHaveBeenCalled();
		});
	});

	describe("sendAllListChangedNotifications", () => {
		let loggerInfoSpy: ReturnType<typeof spyOn>;

		beforeEach(() => {
			loggerInfoSpy = spyOn(logger, "info");
		});

		afterEach(() => {
			loggerInfoSpy.mockRestore();
		});

		test("should call all notification methods successfully", async () => {
			// Act
			await sendAllListChangedNotifications(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendResourceListChanged).toHaveBeenCalledTimes(1);
			expect(mockServer.sendToolListChanged).toHaveBeenCalledTimes(1);
			expect(mockServer.sendPromptListChanged).toHaveBeenCalledTimes(1);
			expect(loggerInfoSpy).toHaveBeenCalledWith(
				"Sending list changed notifications to connected clients",
			);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Completed sending all list changed notifications",
			);
		});

		test("should handle partial failures gracefully", async () => {
			// Arrange
			const error = new Error("Server error");
			mockServer.sendToolListChanged = mock(async () => {
				throw error;
			});

			// Act
			await sendAllListChangedNotifications(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendResourceListChanged).toHaveBeenCalledTimes(1);
			expect(mockServer.sendToolListChanged).toHaveBeenCalledTimes(1);
			expect(mockServer.sendPromptListChanged).toHaveBeenCalledTimes(1);
			expect(loggerInfoSpy).toHaveBeenCalledWith(
				"Sending list changed notifications to connected clients",
			);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Completed sending all list changed notifications",
			);
			expect(loggerWarnSpy).toHaveBeenCalledWith(
				"Failed to send tool list changed notification",
				error,
			);
		});

		test("should continue even if all notifications fail", async () => {
			// Arrange
			const error1 = new Error("Resource error");
			const error2 = new Error("Tool error");
			const error3 = new Error("Prompt error");

			mockServer.sendResourceListChanged = mock(async () => {
				throw error1;
			});
			mockServer.sendToolListChanged = mock(async () => {
				throw error2;
			});
			mockServer.sendPromptListChanged = mock(async () => {
				throw error3;
			});

			// Act
			await sendAllListChangedNotifications(mockServer as unknown as Server);

			// Assert
			expect(mockServer.sendResourceListChanged).toHaveBeenCalledTimes(1);
			expect(mockServer.sendToolListChanged).toHaveBeenCalledTimes(1);
			expect(mockServer.sendPromptListChanged).toHaveBeenCalledTimes(1);
			expect(loggerInfoSpy).toHaveBeenCalledWith(
				"Sending list changed notifications to connected clients",
			);
			expect(loggerDebugSpy).toHaveBeenCalledWith(
				"Completed sending all list changed notifications",
			);
			expect(loggerWarnSpy).toHaveBeenCalledTimes(3);
		});
	});
});
