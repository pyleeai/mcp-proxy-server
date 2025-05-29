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
import {
	CallToolRequestSchema,
	CallToolResultSchema,
	GetPromptRequestSchema,
	GetPromptResultSchema,
	InitializeRequestSchema,
	ListPromptsRequestSchema,
	ListPromptsResultSchema,
	ListResourceTemplatesRequestSchema,
	ListResourceTemplatesResultSchema,
	ListResourcesRequestSchema,
	ListResourcesResultSchema,
	ListToolsRequestSchema,
	ListToolsResultSchema,
	ReadResourceRequestSchema,
	ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { setRequestHandlers } from "../../src/handlers";
import * as requestModule from "../../src/request";

describe("setRequestHandlers", () => {
	let mockServer: Server;
	let mockListRequestHandler: ReturnType<typeof spyOn>;
	let mockReadRequestHandler: ReturnType<typeof spyOn>;
	let mockHandler: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockHandler = mock(() => Promise.resolve({}));
		mockServer = {
			// Many properties of Server are missing; we provide a minimal mock and cast for testing
			setRequestHandler: mock(),
		} as unknown as Server;
		mockListRequestHandler = spyOn(
			requestModule,
			"listRequestHandler",
		).mockReturnValue(mockHandler);
		mockReadRequestHandler = spyOn(
			requestModule,
			"readRequestHandler",
		).mockReturnValue(mockHandler);
	});

	afterEach(() => {
		mockListRequestHandler.mockRestore();
		mockReadRequestHandler.mockRestore();
	});

	test("should set all request handlers on the server", () => {
		// Arrange
		const expectedHandlers = [
			{ schema: InitializeRequestSchema, type: "initialize" },
			{ schema: GetPromptRequestSchema, type: "read" },
			{ schema: CallToolRequestSchema, type: "read" },
			{ schema: ReadResourceRequestSchema, type: "read" },
			{ schema: ListPromptsRequestSchema, type: "list" },
			{ schema: ListResourcesRequestSchema, type: "list" },
			{ schema: ListToolsRequestSchema, type: "list" },
			{ schema: ListResourceTemplatesRequestSchema, type: "list" },
		];

		// Act
		setRequestHandlers(mockServer);

		// Assert
		expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(
			expectedHandlers.length,
		);
		// biome-ignore lint/complexity/noForEach: Cleaner test code
		expectedHandlers.forEach(({ schema, type }) => {
			if (type === "read") {
				switch (schema) {
					case GetPromptRequestSchema:
						expect(mockReadRequestHandler).toHaveBeenCalledWith(
							GetPromptRequestSchema,
							GetPromptResultSchema,
						);
						expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
							GetPromptRequestSchema,
							mockHandler,
						);
						break;
					case CallToolRequestSchema:
						expect(mockReadRequestHandler).toHaveBeenCalledWith(
							CallToolRequestSchema,
							CallToolResultSchema,
						);
						expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
							CallToolRequestSchema,
							mockHandler,
						);
						break;
					case ReadResourceRequestSchema:
						expect(mockReadRequestHandler).toHaveBeenCalledWith(
							ReadResourceRequestSchema,
							ReadResourceResultSchema,
						);
						expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
							ReadResourceRequestSchema,
							mockHandler,
						);
						break;
				}
			} else if (type === "list") {
				switch (schema) {
					case ListPromptsRequestSchema:
						expect(mockListRequestHandler).toHaveBeenCalledWith(
							ListPromptsRequestSchema,
							ListPromptsResultSchema,
						);
						expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
							ListPromptsRequestSchema,
							mockHandler,
						);
						break;
					case ListResourcesRequestSchema:
						expect(mockListRequestHandler).toHaveBeenCalledWith(
							ListResourcesRequestSchema,
							ListResourcesResultSchema,
						);
						expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
							ListResourcesRequestSchema,
							mockHandler,
						);
						break;
					case ListToolsRequestSchema:
						expect(mockListRequestHandler).toHaveBeenCalledWith(
							ListToolsRequestSchema,
							ListToolsResultSchema,
						);
						expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
							ListToolsRequestSchema,
							mockHandler,
						);
						break;
					case ListResourceTemplatesRequestSchema:
						expect(mockListRequestHandler).toHaveBeenCalledWith(
							ListResourceTemplatesRequestSchema,
							ListResourceTemplatesResultSchema,
						);
						expect(mockServer.setRequestHandler).toHaveBeenCalledWith(
							ListResourceTemplatesRequestSchema,
							mockHandler,
						);
						break;
				}
			}
		});
	});

	test("should configure read handlers with correct request and result schemas", () => {
		// Arrange
		const readHandlers = [
			{
				requestSchema: GetPromptRequestSchema,
				resultSchema: GetPromptResultSchema,
			},
			{
				requestSchema: CallToolRequestSchema,
				resultSchema: CallToolResultSchema,
			},
			{
				requestSchema: ReadResourceRequestSchema,
				resultSchema: ReadResourceResultSchema,
			},
		];

		// Act
		setRequestHandlers(mockServer);

		// Assert
		// biome-ignore lint/complexity/noForEach: Cleaner test code
		readHandlers.forEach(({ requestSchema, resultSchema }) => {
			expect(mockReadRequestHandler).toHaveBeenCalledWith(
				requestSchema,
				resultSchema,
			);
		});
	});

	test("should configure list handlers with correct request and result schemas", () => {
		// Arrange
		const listHandlers = [
			{
				requestSchema: ListPromptsRequestSchema,
				resultSchema: ListPromptsResultSchema,
			},
			{
				requestSchema: ListResourcesRequestSchema,
				resultSchema: ListResourcesResultSchema,
			},
			{
				requestSchema: ListToolsRequestSchema,
				resultSchema: ListToolsResultSchema,
			},
			{
				requestSchema: ListResourceTemplatesRequestSchema,
				resultSchema: ListResourceTemplatesResultSchema,
			},
		];

		// Act
		setRequestHandlers(mockServer);

		// Assert
		// biome-ignore lint/complexity/noForEach: Cleaner test code
		listHandlers.forEach(({ requestSchema, resultSchema }) => {
			expect(mockListRequestHandler).toHaveBeenCalledWith(
				requestSchema,
				resultSchema,
			);
		});
	});
});
