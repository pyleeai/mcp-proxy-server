import * as sdkModule from "@modelcontextprotocol/sdk/server/stdio.js";
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
import * as clientsModule from "../../src/clients";
import * as configModule from "../../src/config";
import * as handlersModule from "../../src/handlers";
import { logger } from "../../src/logger";
import { proxy } from "../../src/proxy";
import * as serverModule from "../../src/server";

class MockStdioServerTransport {
	connect = mock(() => Promise.resolve());
	close = mock(() => Promise.resolve());
}

let mockTransport: MockStdioServerTransport;
let mockFetchConfiguration: ReturnType<typeof spyOn>;
let mockCreateServer: ReturnType<typeof spyOn>;
let mockSetRequestHandlers: ReturnType<typeof spyOn>;
let mockConnectClients: ReturnType<typeof spyOn>;
let mockCleanup: ReturnType<typeof spyOn>;
let processExitSpy: ReturnType<typeof spyOn>;
let processOnSpy: ReturnType<typeof spyOn>;
let mockLoggerInfo: ReturnType<typeof spyOn>;

describe("proxy", () => {
	const mockConfig = {
		mcpServers: {
			server1: { url: "http://example.com" },
		},
	};
	let mockServerConnectLocal: ReturnType<typeof mock>;
	let mockServerCloseLocal: ReturnType<typeof mock>;
	interface MockServerType {
		connect: typeof mockServerConnectLocal;
		close: typeof mockServerCloseLocal;
		setRequestHandler: ReturnType<typeof mock>;
	}
	const mockServer: MockServerType = {
		connect: undefined as unknown as typeof mockServerConnectLocal,
		close: undefined as unknown as typeof mockServerCloseLocal,
		setRequestHandler: mock(() => undefined),
	};

	beforeEach(() => {
		mockTransport = new MockStdioServerTransport();
		mockServerConnectLocal = mock(() => Promise.resolve());
		mockServerCloseLocal = mock(() => Promise.resolve());
		mockServer.connect = mockServerConnectLocal;
		mockServer.close = mockServerCloseLocal;

		(
			spyOn as unknown as <T, K extends keyof T>(
				obj: T,
				method: K,
			) => { mockImplementation: (impl: T[K]) => unknown }
		)(sdkModule, "StdioServerTransport").mockImplementation(function (
			this: typeof mockTransport,
			_stdin?: NodeJS.ReadableStream,
			_stdout?: NodeJS.WritableStream,
		) {
			return mockTransport as unknown as InstanceType<
				typeof sdkModule.StdioServerTransport
			>;
		} as unknown as typeof sdkModule.StdioServerTransport);

		mockFetchConfiguration = spyOn(
			configModule,
			"fetchConfiguration",
		).mockImplementation(() => Promise.resolve(mockConfig));
		mockCreateServer = spyOn(serverModule, "createServer").mockImplementation(
			// @ts-ignore
			() => mockServer,
		);
		mockSetRequestHandlers = spyOn(handlersModule, "setRequestHandlers");
		mockConnectClients = spyOn(clientsModule, "connectClients");
		mockCleanup = spyOn(cleanupModule, "cleanup").mockImplementation(() =>
			Promise.resolve(),
		);
		mockLoggerInfo = spyOn(logger, "info");
		processOnSpy = spyOn(process, "on");
		processExitSpy = spyOn(process, "exit").mockImplementation(
			() => undefined as never,
		);
	});

	afterEach(() => {
		mockFetchConfiguration.mockRestore();
		mockCreateServer.mockRestore();
		mockSetRequestHandlers.mockRestore();
		mockConnectClients.mockRestore();
		mockCleanup.mockRestore();
		mockLoggerInfo.mockRestore();
		processOnSpy.mockRestore();
		processExitSpy.mockRestore();
	});

	test("should set up proxy correctly", async () => {
		// Act
		await proxy();

		// Assert
		expect(mockFetchConfiguration).toHaveBeenCalledTimes(1);
		expect(mockCreateServer).toHaveBeenCalledTimes(1);
		expect(mockSetRequestHandlers).toHaveBeenCalledWith(mockServer);
		expect(mockServerConnectLocal).toHaveBeenCalledTimes(1);
		expect(mockServerConnectLocal).toHaveBeenCalledWith(mockTransport);
		expect(mockConnectClients).toHaveBeenCalledWith(mockConfig);
		expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
	});

	test("should handle SIGINT correctly", async () => {
		// Arrange
		await proxy();
		const sigintHandler = processOnSpy.mock.calls.find(
			([event]: [string, unknown]) => event === "SIGINT",
		)?.[1] as () => Promise<void>;
		expect(sigintHandler).toBeDefined();

		// Act
		await sigintHandler();

		// Assert
		expect(mockCleanup).toHaveBeenCalledTimes(1);
		expect(mockServerCloseLocal).toHaveBeenCalledTimes(1);
		expect(processExitSpy).toHaveBeenCalledWith(0);
	});
});
