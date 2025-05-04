import { beforeEach, describe, expect, mock, test } from "bun:test";
import { name, version } from "../../package.json" with { type: "json" };
import { createClient } from "../../src/client";

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
		// Act
		const client = createClient();

		// Assert
		expect(client).toBeDefined();
		const clientInfo = mockClientInstance.client as {
			name: string;
			version: string;
		};
		expect(clientInfo.name).toBe(name);
		expect(clientInfo.version).toBe(version);
	});

	test("should configure client with required capabilities", () => {
		// Act
		const client = createClient();

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
		// Act
		const client = createClient();

		// Assert
		expect(client).toBeDefined();
		expect(mockClientInstance.client).toEqual({ name, version });
	});
});
