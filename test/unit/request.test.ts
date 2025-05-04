// @ts-nocheck

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
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as dataModule from "../../src/data";
import { ClientRequestError } from "../../src/errors";
import { logger } from "../../src/logger";
import {
	clientRequest,
	listRequestHandler,
	readRequestHandler,
} from "../../src/request";

describe("clientRequest", () => {
	let mockClient: Record<string, unknown>;
	let mockRequest: { method: string; params: Record<string, unknown> };
	let mockResultSchema: z.ZodObject<z.ZodRawShape>;
	let originalLoggerDebug: typeof logger.debug;
	let originalLoggerWarn: typeof logger.warn;

	beforeEach(() => {
		mockRequest = { method: "getUser", params: { name: "alice" } };
		mockResultSchema = z.object({ success: z.boolean() });
		mockClient = {
			getServerVersion: mock(() => ({ name: "TestServer", version: "1.0.0" })),
			request: mock(),
		};
		originalLoggerDebug = logger.debug;
		originalLoggerWarn = logger.warn;
		// @ts-expect-error intentional mock
		logger.debug = mock();
		// @ts-expect-error intentional mock
		logger.warn = mock();
	});

	afterEach(() => {
		logger.debug = originalLoggerDebug;
		logger.warn = originalLoggerWarn;
	});

	test("successfully performs the request", async () => {
		// Arrange
		const expectedResult = { success: true };
		(mockClient.request as jest.Mock).mockResolvedValue(expectedResult);

		// Act
		const result = await clientRequest(
			mockClient,
			mockRequest,
			mockResultSchema,
			"getUser",
			"alice",
		);

		// Assert
		expect(result).toEqual(expectedResult);
		expect(logger.debug).toHaveBeenCalledWith(
			"Requesting getUser:alice from TestServer (1.0.0)",
		);
		expect(mockClient.request).toHaveBeenCalledWith(
			mockRequest,
			mockResultSchema,
		);
	});

	test("handles McpError with MethodNotFound gracefully", async () => {
		// Arrange
		const methodNotFoundError = new McpError(
			ErrorCode.MethodNotFound,
			"Method not found",
		);
		(mockClient.request as jest.Mock).mockRejectedValue(methodNotFoundError);

		// Act
		const result = await clientRequest(
			mockClient,
			mockRequest,
			mockResultSchema,
			"getUser",
			"alice",
		);

		// Assert
		expect(result).toEqual({});
		expect(logger.warn).toHaveBeenCalledWith(
			"Method getUser not found in TestServer",
		);
	});

	test("handles McpError with RequestTimeout gracefully", async () => {
		// Arrange
		const requestTimeoutError = new McpError(
			ErrorCode.RequestTimeout,
			"Request timed out",
		);
		(mockClient.request as jest.Mock).mockRejectedValue(requestTimeoutError);

		// Act
		const result = await clientRequest(
			mockClient,
			mockRequest,
			mockResultSchema,
			"getUser",
			"alice",
		);

		// Assert
		expect(result).toEqual({});
		expect(logger.warn).toHaveBeenCalledWith(
			"Method getUser timed out in TestServer",
		);
	});

	test("throws and calls fail on error", async () => {
		// Arrange
		const mockError = new Error("fail");
		(mockClient.request as jest.Mock).mockRejectedValue(mockError);
		const failSpy = spyOn(
			await import("../../src/utils"),
			"fail",
		).mockImplementation(() => {
			throw new ClientRequestError("Mocked fail", { cause: mockError });
		});

		try {
			// Act & Assert
			expect(
				clientRequest(
					mockClient,
					mockRequest,
					mockResultSchema,
					"getUser",
					"alice",
				),
			).rejects.toThrow(ClientRequestError);
			expect(failSpy).toHaveBeenCalledWith(
				"Request error with getUser:alice to TestServer (1.0.0)",
				ClientRequestError,
				mockError,
			);
		} finally {
			failSpy.mockRestore();
		}
	});

	test("handles missing identifier and version safely", async () => {
		// Arrange
		mockClient.getServerVersion = mock(() => undefined);
		const expectedResult = { success: true };
		(mockClient.request as jest.Mock).mockResolvedValue(expectedResult);

		// Act
		const result = await clientRequest(
			mockClient,
			mockRequest,
			mockResultSchema,
			"method",
		);

		// Assert
		expect(result).toEqual(expectedResult);
		expect(logger.debug).toHaveBeenCalledWith(
			"Requesting method:undefined from undefined (undefined)",
		);
	});
});

describe("readRequestHandler", () => {
	const requestSchema = z.object({
		method: z.literal("test/get"),
		params: z.object({
			name: z.string().optional(),
			uri: z.string().optional(),
		}),
	});
	const resultSchema = z.object({
		id: z.string(),
		name: z.string(),
	});
	type TestResult = z.infer<typeof resultSchema>;
	const mockClient = {
		request: mock(() =>
			Promise.resolve({
				id: "test-id",
				name: "Test Item",
			}),
		),
		getServerVersion: mock(() => ({ name: "test-server", version: "1.0.0" })),
	};
	const mockErrorClient = {
		request: mock(() => Promise.reject(new Error("Test error"))),
		getServerVersion: mock(() => ({ name: "error-server", version: "1.0.0" })),
	};
	let mockGetClientFor: ReturnType<typeof spyOn>;
	let mockLoggerDebug: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockGetClientFor = spyOn(dataModule, "getClientFor");
		mockLoggerDebug = spyOn(logger, "debug");
	});

	afterEach(() => {
		mockGetClientFor.mockRestore();
		mockLoggerDebug.mockRestore();
	});

	test("should forward request to the correct client and return the result", async () => {
		// Arrange
		mockGetClientFor.mockReturnValue(mockClient);
		const handler = readRequestHandler(requestSchema, resultSchema);

		// Act
		const result = await handler({
			method: "test/get",
			params: { name: "test-name" },
		});

		// Assert
		expect(mockGetClientFor).toHaveBeenCalledWith("test/get", "test-name");
		expect(mockClient.request).toHaveBeenCalledWith(
			{ method: "test/get", params: { name: "test-name" } },
			resultSchema,
		);
		expect(mockClient.getServerVersion).toHaveBeenCalled();
		expect(result).toEqual({
			id: "test-id",
			name: "Test Item",
		});
		expect(mockLoggerDebug).toHaveBeenCalledWith(
			"Requesting test/get:test-name from test-server (1.0.0)",
		);
	});

	test("should use uri parameter when name is not provided", async () => {
		// Arrange
		mockGetClientFor.mockReturnValue(mockClient);
		const handler = readRequestHandler(requestSchema, resultSchema);

		// Act
		const result = await handler({
			method: "test/get",
			params: { uri: "test-uri" },
		});

		// Assert
		expect(mockGetClientFor).toHaveBeenCalledWith("test/get", "test-uri");
		expect(mockClient.request).toHaveBeenCalledWith(
			{ method: "test/get", params: { uri: "test-uri" } },
			resultSchema,
		);
		expect(result).toEqual({
			id: "test-id",
			name: "Test Item",
		});
	});

	test("throws ClientRequestError when client request fails", async () => {
		// Arrange
		mockGetClientFor.mockReturnValue(mockErrorClient);
		const handler = readRequestHandler(requestSchema, resultSchema);

		// Act & Assert
		try {
			await handler({
				method: "test/get",
				params: { name: "error-name" },
			});
			throw new Error("Expected function to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(ClientRequestError);
		}

		expect(mockGetClientFor).toHaveBeenCalledWith("test/get", "error-name");
		expect(mockErrorClient.request).toHaveBeenCalledWith(
			{ method: "test/get", params: { name: "error-name" } },
			resultSchema,
		);
		expect(mockErrorClient.getServerVersion).toHaveBeenCalled();
	});
});

describe("listRequestHandler", () => {
	const requestSchema = z.object({
		method: z.literal("test/list"),
		params: z.object({
			name: z.string().optional(),
			uri: z.string().optional(),
		}),
	});
	const resultSchema = z.object({
		items: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
			}),
		),
	});
	const mockClient1 = {
		request: mock(() =>
			Promise.resolve({
				items: [
					{ id: "c1-item1", name: "Client 1 Item 1" },
					{ id: "c1-item2", name: "Client 1 Item 2" },
				],
			}),
		),
		getServerVersion: mock(() => ({ name: "client1", version: "1.0.0" })),
	};
	const mockClient2 = {
		request: mock(() =>
			Promise.resolve({
				items: [
					{ id: "c2-item1", name: "Client 2 Item 1" },
					{ id: "c2-item2", name: "Client 2 Item 2" },
				],
			}),
		),
		getServerVersion: mock(() => ({ name: "client2", version: "1.0.0" })),
	};
	const mockErrorClient = {
		request: mock(() => Promise.reject(new Error("Test error"))),
		getServerVersion: mock(() => ({ name: "error-client", version: "1.0.0" })),
	};
	const mockMethodNotFoundClient = {
		request: mock(() =>
			Promise.reject(
				new McpError(ErrorCode.MethodNotFound, "Method not found"),
			),
		),
		getServerVersion: mock(() => ({
			name: "not-found-client",
			version: "1.0.0",
		})),
	};
	const mockEmptyClient = {
		request: mock(() => Promise.resolve({ items: [] })),
		getServerVersion: mock(() => ({ name: "empty-client", version: "1.0.0" })),
	};

	const mockInvalidClient = {
		request: mock(() => Promise.resolve({ items: "not-an-array" })),
		getServerVersion: mock(() => ({
			name: "invalid-client",
			version: "1.0.0",
		})),
	};
	let mockGetAllClients: ReturnType<typeof spyOn>;
	let mockGetKeyFor: ReturnType<typeof spyOn>;
	let mockGetReadMethodFor: ReturnType<typeof spyOn>;
	let mockSetClientFor: ReturnType<typeof spyOn>;
	let mockLoggerDebug: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockGetAllClients = spyOn(dataModule, "getAllClients");
		mockGetKeyFor = spyOn(dataModule, "getKeyFor");
		mockGetReadMethodFor = spyOn(dataModule, "getReadMethodFor");
		mockSetClientFor = spyOn(dataModule, "setClientFor");
		mockLoggerDebug = spyOn(logger, "debug");
		mockGetKeyFor.mockReturnValue("items");
		mockGetReadMethodFor.mockReturnValue("test/get");
	});

	afterEach(() => {
		mockGetAllClients.mockRestore();
		mockGetKeyFor.mockRestore();
		mockGetReadMethodFor.mockRestore();
		mockSetClientFor.mockRestore();
		mockLoggerDebug.mockRestore();
	});

	test("should process items from all successful clients", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([mockClient1, mockClient2]);
		const handler = listRequestHandler(requestSchema, resultSchema);

		// Act
		const result = await handler({
			method: "test/list",
			params: { name: "test-filter" },
		});

		// Assert
		expect(mockGetAllClients).toHaveBeenCalled();
		expect(mockClient1.request).toHaveBeenCalledWith(
			{ method: "test/list", params: { name: "test-filter" } },
			resultSchema,
		);
		expect(mockClient2.request).toHaveBeenCalledWith(
			{ method: "test/list", params: { name: "test-filter" } },
			resultSchema,
		);
		expect(mockSetClientFor).toHaveBeenCalled();
		expect(result).toEqual({
			items: [
				{
					id: "c1-item1",
					name: "Client 1 Item 1",
					description: "[client1] ",
				},
				{
					id: "c1-item2",
					name: "Client 1 Item 2",
					description: "[client1] ",
				},
				{
					id: "c2-item1",
					name: "Client 2 Item 1",
					description: "[client2] ",
				},
				{
					id: "c2-item2",
					name: "Client 2 Item 2",
					description: "[client2] ",
				},
			],
		});
	});

	test("should handle errors from clients gracefully", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([mockClient1, mockErrorClient]);
		const handler = listRequestHandler(requestSchema, resultSchema);

		// Act
		const result = await handler({ method: "test/list", params: {} });

		// Assert
		expect(result).toEqual({
			items: [
				{
					id: "c1-item1",
					name: "Client 1 Item 1",
					description: "[client1] ",
				},
				{
					id: "c1-item2",
					name: "Client 1 Item 2",
					description: "[client1] ",
				},
			],
		});
		expect(mockErrorClient.request).toHaveBeenCalled();
		expect(mockSetClientFor).toHaveBeenCalled();
	});

	test("should handle McpError with MethodNotFound code gracefully", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([mockMethodNotFoundClient]);
		const handler = listRequestHandler(requestSchema, resultSchema);

		// Act
		const result = await handler({ method: "test/list", params: {} });

		// Assert
		expect(result).toEqual({ items: [] });
		expect(mockMethodNotFoundClient.request).toHaveBeenCalled();
		expect(mockSetClientFor).not.toHaveBeenCalled();
	});

	test("should handle empty array results", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([mockEmptyClient]);
		const handler = listRequestHandler(requestSchema, resultSchema);

		// Act
		const result = await handler({ method: "test/list", params: {} });

		// Assert
		expect(result).toEqual({ items: [] });
		expect(mockEmptyClient.request).toHaveBeenCalled();
	});

	test("should handle non-array results", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([mockInvalidClient]);
		const handler = listRequestHandler(requestSchema, resultSchema);

		// Act
		const result = await handler({ method: "test/list", params: {} });

		// Assert
		expect(result).toEqual({ items: [] });
		expect(mockInvalidClient.request).toHaveBeenCalled();
	});

	test("should work with multiple clients with mixed results and errors", async () => {
		// Arrange
		mockGetAllClients.mockReturnValue([
			mockClient1,
			mockErrorClient,
			mockEmptyClient,
			mockClient2,
		]);
		const handler = listRequestHandler(requestSchema, resultSchema);

		// Act
		const result = await handler({ method: "test/list", params: {} });

		// Assert
		expect(result).toEqual({
			items: [
				{
					id: "c1-item1",
					name: "Client 1 Item 1",
					description: "[client1] ",
				},
				{
					id: "c1-item2",
					name: "Client 1 Item 2",
					description: "[client1] ",
				},
				{
					id: "c2-item1",
					name: "Client 2 Item 1",
					description: "[client2] ",
				},
				{
					id: "c2-item2",
					name: "Client 2 Item 2",
					description: "[client2] ",
				},
			],
		});
		expect(mockSetClientFor).toHaveBeenCalled();
		expect(mockClient1.request).toHaveBeenCalled();
		expect(mockClient2.request).toHaveBeenCalled();
		expect(mockErrorClient.request).toHaveBeenCalled();
		expect(mockEmptyClient.request).toHaveBeenCalled();
	});

	test("should properly cache items with their respective clients", async () => {
		// Arrange
		const mockPromptClient = {
			request: mock(() =>
				Promise.resolve({
					prompts: [
						{
							name: "echo",
							arguments: [{ name: "message", required: true }],
						},
						{
							name: "summarize",
							arguments: [{ name: "text", required: true }],
						},
					],
				}),
			),
			getServerVersion: mock(() => ({
				name: "prompt-client",
				version: "1.0.0",
			})),
		};
		const mockToolClient = {
			request: mock(() =>
				Promise.resolve({
					tools: [
						{
							name: "calculator",
							arguments: [{ name: "expression", required: true }],
						},
						{
							name: "weather",
							arguments: [{ name: "location", required: true }],
						},
					],
				}),
			),
			getServerVersion: mock(() => ({ name: "tool-client", version: "1.0.0" })),
		};
		const mockResourceClient = {
			request: mock(() =>
				Promise.resolve({
					resources: [
						{
							name: "image1",
							description: "A test image",
						},
						{
							name: "document1",
							description: "A test document",
						},
					],
				}),
			),
			getServerVersion: mock(() => ({
				name: "resource-client",
				version: "1.0.0",
			})),
		};
		mockGetKeyFor.mockImplementation((method) => {
			switch (method) {
				case "prompts/list":
					return "prompts";
				case "tools/list":
					return "tools";
				case "resources/list":
					return "resources";
				default:
					return method;
			}
		});
		mockGetReadMethodFor.mockImplementation((method) => {
			switch (method) {
				case "prompts/list":
					return "prompts/get";
				case "tools/list":
					return "tools/call";
				case "resources/list":
					return "resources/read";
				default:
					return method;
			}
		});
		const promptsSchema = z.object({
			method: z.literal("prompts/list"),
			params: z.object({
				name: z.string().optional(),
				uri: z.string().optional(),
			}),
		});
		const promptsResultSchema = z.object({
			prompts: z.array(
				z.object({
					name: z.string(),
					arguments: z.array(
						z.object({
							name: z.string(),
							required: z.boolean(),
						}),
					),
				}),
			),
		});
		const toolsSchema = z.object({
			method: z.literal("tools/list"),
			params: z.object({
				name: z.string().optional(),
				uri: z.string().optional(),
			}),
		});
		const toolsResultSchema = z.object({
			tools: z.array(
				z.object({
					name: z.string(),
					arguments: z.array(
						z.object({
							name: z.string(),
							required: z.boolean(),
						}),
					),
				}),
			),
		});
		const resourcesSchema = z.object({
			method: z.literal("resources/list"),
			params: z.object({
				name: z.string().optional(),
				uri: z.string().optional(),
			}),
		});
		const resourcesResultSchema = z.object({
			resources: z.array(
				z.object({
					name: z.string(),
					description: z.string(),
				}),
			),
		});

		// Act
		mockGetAllClients.mockReturnValue([mockPromptClient]);
		const promptsHandler = listRequestHandler(
			promptsSchema,
			promptsResultSchema,
		);
		await promptsHandler({ method: "prompts/list", params: {} });
		mockGetAllClients.mockReturnValue([mockToolClient]);
		const toolsHandler = listRequestHandler(toolsSchema, toolsResultSchema);
		await toolsHandler({ method: "tools/list", params: {} });
		mockGetAllClients.mockReturnValue([mockResourceClient]);
		const resourcesHandler = listRequestHandler(
			resourcesSchema,
			resourcesResultSchema,
		);
		await resourcesHandler({ method: "resources/list", params: {} });

		// Assert
		expect(mockSetClientFor).toHaveBeenCalledWith(
			"prompts/get",
			"echo",
			mockPromptClient,
		);
		expect(mockSetClientFor).toHaveBeenCalledWith(
			"prompts/get",
			"summarize",
			mockPromptClient,
		);
		expect(mockSetClientFor).toHaveBeenCalledWith(
			"tools/call",
			"calculator",
			mockToolClient,
		);
		expect(mockSetClientFor).toHaveBeenCalledWith(
			"tools/call",
			"weather",
			mockToolClient,
		);
		expect(mockSetClientFor).toHaveBeenCalledWith(
			"resources/read",
			"image1",
			mockResourceClient,
		);
		expect(mockSetClientFor).toHaveBeenCalledWith(
			"resources/read",
			"document1",
			mockResourceClient,
		);
	});
});
