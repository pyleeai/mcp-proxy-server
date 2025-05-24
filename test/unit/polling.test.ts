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
	startConfigurationPolling,
	stopConfigurationPolling,
} from "../../src/polling";

const ENV_MODULE = "../../src/env";

describe("Configuration Polling", () => {
	let loggerInfoSpy: ReturnType<typeof spyOn>;
	let setIntervalSpy: ReturnType<typeof spyOn>;
	let clearIntervalSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		loggerInfoSpy = spyOn(logger, "info");
		setIntervalSpy = spyOn(globalThis, "setInterval");
		clearIntervalSpy = spyOn(globalThis, "clearInterval");
		stopConfigurationPolling();
	});

	afterEach(() => {
		stopConfigurationPolling();
		loggerInfoSpy.mockRestore();
		setIntervalSpy.mockRestore();
		clearIntervalSpy.mockRestore();
	});

	test("should start polling when interval > 0", () => {
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_POLL_INTERVAL: 1000,
		}));

		const stopPolling = startConfigurationPolling("http://test.com");

		expect(typeof stopPolling).toBe("function");
		expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
	});

	test("should not start polling when interval is 0", () => {
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_POLL_INTERVAL: 0,
		}));

		const stopPolling = startConfigurationPolling("http://test.com");

		expect(typeof stopPolling).toBe("function");
		expect(setIntervalSpy).not.toHaveBeenCalled();
	});

	test("should stop polling", () => {
		mock.module(ENV_MODULE, () => ({
			CONFIGURATION_POLL_INTERVAL: 1000,
		}));

		startConfigurationPolling("http://test.com");
		stopConfigurationPolling();

		expect(clearIntervalSpy).toHaveBeenCalled();
	});
});
