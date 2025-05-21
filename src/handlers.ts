// @ts-nocheck

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
import {
	listRequestHandler,
	readRequestHandler,
	initializeRequestHandler,
} from "./request";

export const setRequestHandlers = (server: Server) => {
	server.setRequestHandler(InitializeRequestSchema, initializeRequestHandler());

	server.setRequestHandler(
		GetPromptRequestSchema,
		readRequestHandler(GetPromptRequestSchema, GetPromptResultSchema),
	);

	server.setRequestHandler(
		CallToolRequestSchema,
		readRequestHandler(CallToolRequestSchema, CallToolResultSchema),
	);

	server.setRequestHandler(
		ReadResourceRequestSchema,
		readRequestHandler(ReadResourceRequestSchema, ReadResourceResultSchema),
	);

	server.setRequestHandler(
		ListPromptsRequestSchema,
		listRequestHandler(ListPromptsRequestSchema, ListPromptsResultSchema),
	);

	server.setRequestHandler(
		ListResourcesRequestSchema,
		listRequestHandler(ListResourcesRequestSchema, ListResourcesResultSchema),
	);

	server.setRequestHandler(
		ListToolsRequestSchema,
		listRequestHandler(ListToolsRequestSchema, ListToolsResultSchema),
	);

	server.setRequestHandler(
		ListResourceTemplatesRequestSchema,
		listRequestHandler(
			ListResourceTemplatesRequestSchema,
			ListResourceTemplatesResultSchema,
		),
	);
};
