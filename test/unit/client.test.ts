import { beforeEach, describe, expect, mock, test } from "bun:test";
import { createClient } from "../../src/client";
import type { Server } from "../../src/types";

describe("createClient", () => {
	let mockClientInstance: Record<string, unknown>;

	beforeEach(() => {
		mockClientInstance = {};
		mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
			Client: class MockClient {
				constructor(
					client: Record<string, unknown>,
					options: Record<string, unknown>,
				) {
					Object.assign(mockClientInstance, { client, options });
				}
			},
		}));
	});

	test("should work with minimal server configuration", () => {
		// Arrange
		const server: Server = {};

		// Act
		const client = createClient(server);

		// Assert
		expect(client).toBeDefined();
		const clientInfo = mockClientInstance.client as {
			name: string;
			version: string;
		};
		expect(clientInfo.name).toBe("mcp-proxy-client");
		expect(clientInfo.version).toBe("1.0.0");
	});

	test("should configure client with required capabilities", () => {
		// Arrange
		const server: Server = {
			url: "http://example.com",
		};

		// Act
		const client = createClient(server);

		// Assert
		const options = mockClientInstance.options as {
			capabilities: Record<string, unknown>;
		};
		expect(options.capabilities).toEqual({
			prompts: {},
			resources: { subscribe: true },
			tools: {},
		});
	});

	test("should create a client with correct parameters", () => {
		// Arrange
		const server: Server = {
			url: "http://example.com",
			command: "test-command",
			args: ["--arg1", "--arg2"],
			env: ["ENV=test"],
		};

		// Act
		const client = createClient(server);

		// Assert
		expect(client).toBeDefined();
		expect(mockClientInstance.client).toEqual({
			name: "mcp-proxy-client",
			version: "1.0.0",
		});
	});
});
