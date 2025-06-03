import { beforeEach, describe, expect, mock, test } from "bun:test";
import { name, version } from "../../package.json" with { type: "json" };
import { createServer } from "../../src/server";

describe("createServer", () => {
	let mockServerInstance: Record<string, unknown>;

	beforeEach(() => {
		mockServerInstance = {};
		mock.module("@modelcontextprotocol/sdk/server/index.js", () => ({
			Server: class MockServer {
				constructor(
					server: Record<string, unknown>,
					options: Record<string, unknown>,
				) {
					Object.assign(mockServerInstance, { server, options });
				}
			},
		}));
	});

	test("should create a server instance", () => {
		// Act
		const server = createServer();

		// Assert
		expect(server).toBeDefined();
	});

	test("should configure server with correct server info", () => {
		// Act
		const server = createServer();

		// Assert
		const serverInfo = mockServerInstance.server as {
			name: string;
			version: string;
		};
		expect(serverInfo.name).toBe(name);
		expect(serverInfo.version).toBe(version);
	});

	test("should configure server with required capabilities", () => {
		// Act
		const server = createServer();

		// Assert
		const options = mockServerInstance.options as {
			capabilities: Record<string, unknown>;
		};
		expect(options.capabilities).toEqual({
			prompts: {},
			resources: { subscribe: true },
			tools: {
				listChanged: true,
			},
		});
	});

	test("should create a server with correct parameters", () => {
		// Act
		const server = createServer();

		// Assert
		expect(server).toBeDefined();
		expect(mockServerInstance.server).toEqual({ name, version });
	});
});
