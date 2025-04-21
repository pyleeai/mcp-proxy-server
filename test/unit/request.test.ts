import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";
import * as dataModule from "../../src/data";
import { getRequestCache } from "../../src/data";
import { logger } from "../../src/logger";
import { getRequestHandler, listRequestHandler } from "../../src/request";
import type {
	ClientState,
	GetRequestHandlerConfig,
	ListRequestHandlerConfig,
} from "../../src/types";

describe("getRequestHandler", () => {
	const mockSchema = z.object({
		id: z.string(),
		name: z.string(),
	});
	const mockConfig: GetRequestHandlerConfig = {
		method: "test/get",
		param: "id",
	};
	const mockClient: ClientState = {
		name: "test-client",
		client: {
			request: mock(() =>
				Promise.resolve({
					id: "test-id",
					name: "Test Item",
				}),
			),
		} as unknown as Client,
		transport: Promise.resolve(undefined),
	};
	const mockErrorClient: ClientState = {
		name: "error-client",
		client: {
			request: mock(() => Promise.reject(new Error("Test error"))),
		} as unknown as Client,
		transport: Promise.resolve(undefined),
	};

	let mockGetRequestCache: ReturnType<typeof spyOn>;
	let mockLoggerDebug: ReturnType<typeof spyOn>;
	let mockLoggerError: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockGetRequestCache = spyOn(dataModule, "getRequestCache");
		mockLoggerDebug = spyOn(logger, "debug");
		mockLoggerError = spyOn(logger, "error");
	});

	afterEach(() => {
		mockGetRequestCache.mockRestore();
		mockLoggerDebug.mockRestore();
		mockLoggerError.mockRestore();
	});

	test("should handle errors gracefully", async () => {
		// Arrange
		mockGetRequestCache.mockReturnValue(mockErrorClient);
		const handler = getRequestHandler(mockSchema, mockConfig);

		// Act
		const result = await handler({ params: { id: "error-id" } });

		// Assert
		expect(mockGetRequestCache).toHaveBeenCalledWith("test/get", "error-id");
		expect(mockErrorClient.client.request).toHaveBeenCalledWith(
			{ method: "test/get", params: { id: "error-id" } },
			mockSchema,
		);
		expect(result).toEqual({});
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Forwarding test/get : id request",
		);
		expect(mockLoggerError).toHaveBeenCalledWith(
			"Forwarding error with test/get : id request to error-client",
			expect.any(Error),
		);
	});

	test("should support different parameter names", async () => {
		// Arrange
		const customConfig: GetRequestHandlerConfig = {
			method: "resource/get",
			param: "resourceId",
		};
		mockGetRequestCache.mockReturnValue(mockClient);
		const handler = getRequestHandler(mockSchema, customConfig);

		// Act
		const result = await handler({ params: { resourceId: "resource-123" } });

		// Assert
		expect(mockGetRequestCache).toHaveBeenCalledWith(
			"resource/get",
			"resource-123",
		);
		expect(mockClient.client.request).toHaveBeenCalledWith(
			{ method: "resource/get", params: { resourceId: "resource-123" } },
			mockSchema,
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Forwarding resource/get : resourceId request",
		);
	});

	test("should forward request to the correct client", async () => {
		// Arrange
		mockGetRequestCache.mockReturnValue(mockClient);
		const handler = getRequestHandler(mockSchema, mockConfig);

		// Act
		const result = await handler({ params: { id: "test-id" } });

		// Assert
		expect(mockGetRequestCache).toHaveBeenCalledWith("test/get", "test-id");
		expect(mockClient.client.request).toHaveBeenCalledWith(
			{ method: "test/get", params: { id: "test-id" } },
			mockSchema,
		);
		expect(result).toEqual({
			id: "test-id",
			name: "Test Item",
		});
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Forwarding test/get : id request",
		);
		expect(mockLoggerError).not.toHaveBeenCalled();
	});
});

describe("listRequestHandler", () => {
	const mockSchema = z.object({
		results: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
			}),
		),
	});
	const mockConfig: ListRequestHandlerConfig<typeof mockSchema._type> = {
		method: "test/list",
		param: "filter",
		key: "results",
	};
	const mockClient1: ClientState = {
		name: "client1",
		client: {
			request: mock(() =>
				Promise.resolve({
					results: [
						{ id: "c1-item1", name: "Client 1 Item 1" },
						{ id: "c1-item2", name: "Client 1 Item 2" },
					],
				}),
			),
		} as unknown as Client,
		transport: Promise.resolve(undefined),
	};
	const mockClient2: ClientState = {
		name: "client2",
		client: {
			request: mock(() =>
				Promise.resolve({
					results: [
						{ id: "c2-item1", name: "Client 2 Item 1" },
						{ id: "c2-item2", name: "Client 2 Item 2" },
					],
				}),
			),
		} as unknown as Client,
		transport: Promise.resolve(undefined),
	};
	const mockClient3: ClientState = {
		name: "client3",
		client: {
			request: mock(() => Promise.reject(new Error("Test error"))),
		} as unknown as Client,
		transport: Promise.resolve(undefined),
	};

	let mockGetAllClients: ReturnType<typeof spyOn>;
	let mockLoggerDebug: ReturnType<typeof spyOn>;
	let mockLoggerError: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockGetAllClients = spyOn(dataModule, "getAllClients");
		mockLoggerDebug = spyOn(logger, "debug");
		mockLoggerError = spyOn(logger, "error");
	});

	afterEach(() => {
		mockGetAllClients.mockRestore();
		mockLoggerDebug.mockRestore();
		mockLoggerError.mockRestore();
	});

	test("should handle errors from clients gracefully", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([mockClient1, mockClient3]);
		const processFunction = (client: ClientState, item: unknown) => {
			return {
				clientName: client.name,
				...(item as { id: string; name: string }),
			};
		};
		const handler = listRequestHandler(mockSchema, mockConfig, processFunction);

		// Act
		const result = await handler({ method: "test/list" });

		// Assert
		expect(mockClient1.client.request).toHaveBeenCalledWith(
			{ method: "test/list" },
			mockSchema,
		);
		expect(mockClient3.client.request).toHaveBeenCalledWith(
			{ method: "test/list" },
			mockSchema,
		);

		expect(result.results).toHaveLength(2);
		expect(result.results).toContainEqual({
			clientName: "client1",
			id: "c1-item1",
			name: "Client 1 Item 1",
		});
		expect(result.results).toContainEqual({
			clientName: "client1",
			id: "c1-item2",
			name: "Client 1 Item 2",
		});
		expect(mockLoggerDebug).toHaveBeenCalledTimes(3);
		expect(mockLoggerError).toHaveBeenCalledTimes(1);
		expect(mockLoggerError).toHaveBeenCalledWith(
			"Error collecting test/list from client3",
			expect.any(Error),
		);
	});

	test("should handle non-array results", async () => {
		// Arrange
		const mockClientWithNonArray: ClientState = {
			name: "nonArrayClient",
			client: {
				request: mock(() =>
					Promise.resolve({
						results: "not an array", // Non-array result
					}),
				),
			} as unknown as Client,
			transport: Promise.resolve(undefined),
		};
		mockGetAllClients.mockReturnValue([mockClientWithNonArray]);
		const processFunction = (client: ClientState, item: unknown) => {
			return { clientName: client.name, item };
		};
		const handler = listRequestHandler(mockSchema, mockConfig, processFunction);

		// Act
		const result = await handler({ method: "test/list" });

		// Assert
		expect(mockClientWithNonArray.client.request).toHaveBeenCalledWith(
			{ method: "test/list" },
			mockSchema,
		);
		expect(result.results).toHaveLength(0);
		expect(mockLoggerDebug).toHaveBeenCalledTimes(2);
	});

	test("should handle empty array results", async () => {
		// Arrange
		const mockClientWithEmptyArray: ClientState = {
			name: "emptyArrayClient",
			client: {
				request: mock(() =>
					Promise.resolve({
						results: [], // Empty array
					}),
				),
			} as unknown as Client,
			transport: Promise.resolve(undefined),
		};
		mockGetAllClients.mockReturnValue([mockClientWithEmptyArray]);
		const processFunction = (client: ClientState, item: unknown) => {
			return { clientName: client.name, item };
		};
		const handler = listRequestHandler(mockSchema, mockConfig, processFunction);

		// Act
		const result = await handler({ method: "test/list" });

		// Assert
		expect(mockClientWithEmptyArray.client.request).toHaveBeenCalledWith(
			{ method: "test/list" },
			mockSchema,
		);
		expect(result.results).toHaveLength(0);
		expect(mockLoggerDebug).toHaveBeenCalledTimes(2);
	});

	test("should work with multiple clients with mixed results and errors", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([mockClient1, mockClient2, mockClient3]);
		const processFunction = (client: ClientState, item: unknown) => {
			return {
				clientName: client.name,
				...(item as { id: string; name: string }),
			};
		};
		const handler = listRequestHandler(mockSchema, mockConfig, processFunction);

		// Act
		const result = await handler({ method: "test/list" });

		// Assert
		expect(result.results).toHaveLength(4);
		expect(mockLoggerDebug).toHaveBeenCalledTimes(5);
		expect(mockLoggerError).toHaveBeenCalledTimes(1);
	});

	test("should process items from all successful clients", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([mockClient1, mockClient2]);
		const processFunction = (client: ClientState, item: unknown) => {
			return {
				clientName: client.name,
				...(item as { id: string; name: string }),
			};
		};
		const handler = listRequestHandler(mockSchema, mockConfig, processFunction);

		// Act
		const result = await handler({
			method: "test/list",
			params: { filter: "test" },
		});

		// Assert
		expect(mockClient1.client.request).toHaveBeenCalledWith(
			{ method: "test/list", params: { filter: "test" } },
			mockSchema,
		);
		expect(mockClient2.client.request).toHaveBeenCalledWith(
			{ method: "test/list", params: { filter: "test" } },
			mockSchema,
		);
		expect(result.results).toHaveLength(4);
		expect(result.results).toContainEqual({
			clientName: "client1",
			id: "c1-item1",
			name: "Client 1 Item 1",
		});
		expect(result.results).toContainEqual({
			clientName: "client1",
			id: "c1-item2",
			name: "Client 1 Item 2",
		});
		expect(result.results).toContainEqual({
			clientName: "client2",
			id: "c2-item1",
			name: "Client 2 Item 1",
		});
		expect(result.results).toContainEqual({
			clientName: "client2",
			id: "c2-item2",
			name: "Client 2 Item 2",
		});
		expect(mockLoggerDebug).toHaveBeenCalledTimes(4);
		expect(mockLoggerError).not.toHaveBeenCalled();
	});

	test("verifies items are cached during request handling", async () => {
		// Arrange
		const method = "tools/call";
		const key = "items";
		const item1 = { id: "test-item-1", name: "Test Item 1" };
		const item2 = { id: "test-item-2", name: "Test Item 2" };
		const testClientName = "test-client";
		const mockTestClient: ClientState = {
			name: testClientName,
			client: {
				request: mock(() =>
					Promise.resolve({
						[key]: [item1, item2],
					}),
				),
			} as unknown as Client,
			transport: Promise.resolve(undefined),
		};
		mockGetAllClients.mockReturnValue([mockTestClient]);
		const testSchema = z.object({
			[key]: z.array(
				z.object({
					id: z.string(),
					name: z.string(),
				}),
			),
		});
		const testConfig: ListRequestHandlerConfig<typeof testSchema._type> = {
			method,
			param: "filter",
			key,
		};
		const processFunction = (client: ClientState, item: unknown) => {
			return {
				clientName: client.name,
				...(item as { id: string; name: string }),
			};
		};
		const handler = listRequestHandler(testSchema, testConfig, processFunction);

		// Act
		const result = await handler({ method });

		// Assert
		expect(mockTestClient.client.request).toHaveBeenCalledWith(
			{ method, params: undefined },
			testSchema,
		);
		expect(result[key]).toHaveLength(2);
		expect(result[key]).toContainEqual({
			clientName: testClientName,
			id: "test-item-1",
			name: "Test Item 1",
		});
		expect(result[key]).toContainEqual({
			clientName: testClientName,
			id: "test-item-2",
			name: "Test Item 2",
		});
		const cachedClientForItem1 = getRequestCache(method, item1.id);
		const cachedClientForItem2 = getRequestCache(method, item2.id);
		expect(cachedClientForItem1.name).toBe(testClientName);
		expect(cachedClientForItem2.name).toBe(testClientName);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			`Collecting ${method} from ${testClientName}`,
		);
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			`Collected ${method} from ${testClientName}`,
		);
	});
});
