import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { logger } from "../../src/logger";
import {
	getCurrentConfiguration,
	startConfigurationPolling,
	stopConfigurationPolling,
} from "../../src/polling";
import type { Configuration } from "../../src/types";

const ENV_MODULE = "../../src/env";

mock.module(ENV_MODULE, () => ({
	CONFIGURATION_POLL_ENABLED: true,
	CONFIGURATION_POLL_INTERVAL: 1000,
}));

describe("Configuration Polling", () => {
	const mockConfiguration: Configuration = {
		mcp: {
			servers: {
				server1: {
					command: "test-command",
					args: ["--test"],
				},
			},
		},
	};

	let loggerInfoSpy: ReturnType<typeof spyOn>;
	let loggerDebugSpy: ReturnType<typeof spyOn>;
	let setIntervalSpy: ReturnType<typeof spyOn>;
	let clearIntervalSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		loggerInfoSpy = spyOn(logger, "info");
		loggerDebugSpy = spyOn(logger, "debug");
		setIntervalSpy = spyOn(globalThis, "setInterval");
		clearIntervalSpy = spyOn(globalThis, "clearInterval");

		stopConfigurationPolling();
	});

	afterEach(() => {
		stopConfigurationPolling();
		loggerInfoSpy.mockRestore();
		loggerDebugSpy.mockRestore();
		setIntervalSpy.mockRestore();
		clearIntervalSpy.mockRestore();
	});

	test("should start polling when enabled", () => {
		const stopPolling = startConfigurationPolling(
			"http://test.com",
			{},
			mockConfiguration,
		);

		expect(typeof stopPolling).toBe("function");
		expect(getCurrentConfiguration()).toBe(mockConfiguration);
		expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
		expect(loggerInfoSpy).toHaveBeenCalledWith(
			"Starting configuration polling every 1000ms",
		);
	});

	test("should not start polling when already running", () => {
		startConfigurationPolling("http://test.com", {}, mockConfiguration);
		startConfigurationPolling("http://test.com", {}, mockConfiguration);

		expect(setIntervalSpy).toHaveBeenCalledTimes(1);
		expect(loggerInfoSpy).toHaveBeenCalledWith(
			"Starting configuration polling every 1000ms",
		);
	});

	test("should stop polling and clear configuration", () => {
		startConfigurationPolling("http://test.com", {}, mockConfiguration);

		expect(getCurrentConfiguration()).toBe(mockConfiguration);

		stopConfigurationPolling();

		expect(getCurrentConfiguration()).toBeNull();
		expect(clearIntervalSpy).toHaveBeenCalled();
		expect(loggerInfoSpy).toHaveBeenCalledWith(
			"Stopping configuration polling",
		);
	});

	test("should handle stopping when not running", () => {
		expect(() => stopConfigurationPolling()).not.toThrow();
	});

	test("should return null when no configuration is set", () => {
		expect(getCurrentConfiguration()).toBeNull();
	});

	test("should return current configuration when polling is active", () => {
		startConfigurationPolling("http://test.com", {}, mockConfiguration);

		expect(getCurrentConfiguration()).toBe(mockConfiguration);
	});
});

describe("Configuration Polling - Disabled", () => {
	let loggerDebugSpy: ReturnType<typeof spyOn>;
	let setIntervalSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_POLL_ENABLED: false,
			CONFIGURATION_POLL_INTERVAL: 1000,
		}));

		loggerDebugSpy = spyOn(logger, "debug");
		setIntervalSpy = spyOn(globalThis, "setInterval");
	});

	afterEach(() => {
		loggerDebugSpy.mockRestore();
		setIntervalSpy.mockRestore();

		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_POLL_ENABLED: true,
			CONFIGURATION_POLL_INTERVAL: 1000,
		}));
	});

	test("should not start polling when disabled", () => {
		const { startConfigurationPolling } = require("../../src/polling");

		const stopPolling = startConfigurationPolling(
			"http://test.com",
			{},
			{
				mcp: { servers: {} },
			},
		);

		expect(typeof stopPolling).toBe("function");
		expect(setIntervalSpy).not.toHaveBeenCalled();
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Configuration polling is disabled",
		);
	});
});
