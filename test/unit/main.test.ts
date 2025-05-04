import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import * as processModule from "../../src/process";
import * as proxyModule from "../../src/proxy";

describe("main", () => {
	let mockProxy: ReturnType<typeof spyOn>;
	let mockHandleSIGINT: ReturnType<typeof spyOn>;
	let mockExitWithError: ReturnType<typeof spyOn>;
	let processOnSpy: ReturnType<typeof spyOn>;
	let mockSigintHandler: ReturnType<typeof mock>;
	let mainModule: { main: () => Promise<void> } | null;

	beforeAll(() => {
		mockProxy = spyOn(proxyModule, "proxy").mockImplementation(() =>
			Promise.resolve({
				[Symbol.dispose]: () => {
					return async () => {
					};
				},
			}),
		);
		mockExitWithError = spyOn(processModule, "exitWithError");
		mockSigintHandler = mock(() => Promise.resolve() as never);
		mockHandleSIGINT = spyOn(processModule, "handleSIGINT").mockImplementation(
			() => mockSigintHandler,
		);
		processOnSpy = spyOn(process, "on");
	});

	afterAll(() => {
		mockProxy.mockRestore();
		mockHandleSIGINT.mockRestore();
		mockExitWithError.mockRestore();
		processOnSpy.mockRestore();
		process.removeAllListeners("SIGINT");
	});

	beforeEach(() => {
		delete require.cache[require.resolve("../../src/main")];
		mainModule = null;
	});

	afterEach(() => {
		delete require.cache[require.resolve("../../src/main")];
		process.removeAllListeners("SIGINT");
		mainModule = null;
	});

	test("should call proxy function", async () => {
		// Arrange
		mainModule = await import("../../src/main");
		mockProxy.mockClear();

		// Act
		await mainModule.main();

		// Assert
		expect(mockProxy).toHaveBeenCalledTimes(1);
	});

	test("should register the SIGINT handler", async () => {
		// Arrange
		processOnSpy.mockClear();

		// Act
		mainModule = await import("../../src/main");

		// Assert
		expect(processOnSpy).toHaveBeenCalledWith("SIGINT", mockHandleSIGINT);
	});

	test("should properly pass the handleSIGINT function to SIGINT event", async () => {
		// Arrange
		let capturedSigintHandler: ((...args: unknown[]) => unknown) | null = null;
		processOnSpy.mockImplementation(
			(event: string, handler: (...args: unknown[]) => unknown) => {
				if (event === "SIGINT") {
					capturedSigintHandler = handler;
				}
				return process;
			},
		);

		// Act
		mainModule = await import("../../src/main");

		// Assert
		expect(capturedSigintHandler).not.toBeNull();
		expect(capturedSigintHandler).toBe(mockHandleSIGINT);
	});

	test("should set up error handling", async () => {
		// Arrange
		const catchSpy = spyOn(Promise.prototype, "catch");
		mainModule = await import("../../src/main");

		// Act
		const mainPromise = mainModule.main();

		// Assert
		expect(typeof mainPromise.catch).toBe("function");
		expect(catchSpy).toHaveBeenCalled();
		catchSpy.mockRestore();
	});
});
