import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
	getAllClientStates,
	getAllClients,
	getRequestCache,
	setClientState,
	setRequestCache,
} from "../../src/data";
import type { ClientState } from "../../src/types";

describe("setClientState", () => {
	let testClientNames: string[] = [];

	beforeEach(() => {
		testClientNames = [];
	});

	test("should store a client state", () => {
			// Arrange
			const testClientName = `test-client-${Date.now()}`;
			testClientNames.push(testClientName);
			const mockClient = { name: "client1" } as unknown as Client;
			const mockTransport = Promise.resolve({
				close: () => {},
				start: () => Promise.resolve(),
				send: () => Promise.resolve(),
			} as unknown as Transport);
			const clientState: ClientState = {
				name: testClientName,
				client: mockClient,
				transport: mockTransport,
			};
			const clientsBefore = getAllClientStates();

			// Act
			setClientState(testClientName, clientState);

			// Assert
			const clientsAfter = getAllClientStates();
			expect(clientsAfter.length).toBe(clientsBefore.length + 1);
			const found = clientsAfter.find((client) => client.name === testClientName);
			expect(found).toEqual(clientState as ClientState);
		});

	test("should overwrite an existing client state with the same name", () => {
		// Arrange
		const testClientName = `test-client-${Date.now()}-overwrite`;
		testClientNames.push(testClientName);
		const mockClient1 = { name: "client1" } as unknown as Client;
		const mockClient2 = { name: "client2" } as unknown as Client;
		const mockTransport1 = Promise.resolve({
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport);
		const mockTransport2 = Promise.resolve({
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport);
		const clientState1: ClientState = {
			name: testClientName,
			client: mockClient1,
			transport: mockTransport1,
		};
		const clientState2: ClientState = {
			name: testClientName,
			client: mockClient2,
			transport: mockTransport2,
		};
		const clientsBefore = getAllClientStates();

		// Act
		setClientState(testClientName, clientState1);
		setClientState(testClientName, clientState2);

		// Assert
		const clientsAfter = getAllClientStates();
		expect(clientsAfter.length).toBe(clientsBefore.length + 1);
		const foundClient = clientsAfter.find(
			(client) => client.name === testClientName,
		);
		expect(foundClient).toEqual(clientState2 as ClientState);
		expect(foundClient).not.toEqual(clientState1);
	});

	afterEach(() => {
		const mockClient = { name: "cleanup" } as unknown as Client;
		const mockTransport = Promise.resolve({
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport);

		for (const name of testClientNames) {
			const cleanupState: ClientState = {
				name: `cleaned-${name}`,
				client: mockClient,
				transport: mockTransport,
			};
			setClientState(name, cleanupState);
		}

		testClientNames = [];
	});
});

describe("getAllClients", () => {
	let testClientNames: string[] = [];

	beforeEach(() => {
		testClientNames = [];
	});

	test("should return an array of Client objects", () => {
		// Act
		const clients = getAllClients();

		// Assert
		expect(clients).toBeInstanceOf(Array);
	});

	test("should return all clients from the client states we add", () => {
		// Arrange
		const testClientName1 = `test-client-${Date.now()}-1-clients`;
		const testClientName2 = `test-client-${Date.now()}-2-clients`;
		testClientNames.push(testClientName1, testClientName2);
		const mockClient1 = { name: "client1", id: "id1" } as unknown as Client;
		const mockClient2 = { name: "client2", id: "id2" } as unknown as Client;
		const mockTransport1 = Promise.resolve({
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport);
		const mockTransport2 = Promise.resolve({
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport);
		const clientState1: ClientState = {
			name: testClientName1,
			client: mockClient1,
			transport: mockTransport1,
		};
		const clientState2: ClientState = {
			name: testClientName2,
			client: mockClient2,
			transport: mockTransport2,
		};
		const clientsBefore = getAllClients();
		setClientState(testClientName1, clientState1);
		setClientState(testClientName2, clientState2);

		// Act
		const clientsAfter = getAllClients();

		// Assert
		expect(clientsAfter.length).toBe(clientsBefore.length + 2);
		expect(clientsAfter).toContain(mockClient1 as Client);
		expect(clientsAfter).toContain(mockClient2 as Client);
	});

	test("should return a new array that does not affect the internal state", () => {
		// Arrange
		const testClientName = `test-client-${Date.now()}-array-copy-clients`;
		testClientNames.push(testClientName);
		const mockClient = { name: "client1", id: "test-id" } as unknown as Client;
		const mockTransport = Promise.resolve({
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport);
		const clientState: ClientState = {
			name: testClientName,
			client: mockClient,
			transport: mockTransport,
		};
		setClientState(testClientName, clientState);
		const initialLength = getAllClients().length;

		// Act
		const clients = getAllClients();
		clients.pop();

		// Assert
		const clientsAfterModification = getAllClients();
		expect(clientsAfterModification.length).toBe(initialLength);
		expect(clientsAfterModification).toContain(mockClient as Client);
	});

	test("should extract only client properties from client states", () => {
		// Arrange
		const testClientName = `test-client-${Date.now()}-extract-clients`;
		testClientNames.push(testClientName);
		const mockClient = {
			name: "extracted-client",
			id: "extract-id",
		} as unknown as Client;
		const mockTransport = Promise.resolve({
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport);
		const clientState: ClientState = {
			name: testClientName,
			client: mockClient,
			transport: mockTransport,
		};
		setClientState(testClientName, clientState);

		// Act
		const clients = getAllClients();
		const foundClient = clients.find((client) => client === mockClient);

		// Assert
		expect(foundClient).toBe(mockClient);
	});

	afterEach(() => {
		const mockClient = { name: "cleanup" } as unknown as Client;
		const mockTransport = Promise.resolve({
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport);

		for (const name of testClientNames) {
			const cleanupState: ClientState = {
				name: `cleaned-${name}`,
				client: mockClient,
				transport: mockTransport,
			};
			setClientState(name, cleanupState);
		}

		testClientNames = [];
	});
});

describe("setRequestCache", () => {
	const mockClientState: ClientState = {
		name: "test-client",
		client: {} as Client,
		transport: Promise.resolve(undefined),
	};

	test("should map tools/list method to tools/call cache", () => {
		// Arrange
		const listMethod = "tools/list";
		const callMethod = "tools/call";
		const key = "test-key";

		// Act
		setRequestCache(listMethod, key, mockClientState);

		// Assert
		const clientState1 = {} as ClientState;
		const clientState2 = {} as ClientState;
		setRequestCache(callMethod, key, clientState1);
		setRequestCache(callMethod, key, clientState2);
	});

	test("should map prompts/list method to prompts/get cache", () => {
		// Arrange
		const listMethod = "prompts/list";
		const getMethod = "prompts/get";
		const key = "test-key";

		// Act
		setRequestCache(listMethod, key, mockClientState);

		// Assert
		const clientState1 = {} as ClientState;
		const clientState2 = {} as ClientState;
		setRequestCache(getMethod, key, clientState1);
		setRequestCache(getMethod, key, clientState2);
	});

	test("should map resources/call method to resources/read cache", () => {
		// Arrange
		const callMethod = "resources/call";
		const readMethod = "resources/read";
		const key = "test-key";

		// Act
		setRequestCache(callMethod, key, mockClientState);

		// Assert
		const clientState1 = {} as ClientState;
		const clientState2 = {} as ClientState;
		setRequestCache(readMethod, key, clientState1);
		setRequestCache(readMethod, key, clientState2);
	});

	test("should use the method directly for non-mapped methods", () => {
		// Arrange
		const method = "tools/call";
		const key = "test-key";

		// Act
		setRequestCache(method, key, mockClientState);

		// Assert
		const clientState = {} as ClientState;
		setRequestCache(method, key, clientState);
	});
});

describe("getRequestCache", () => {
	const mockClientState: ClientState = {
		name: "test-client-get-cache",
		client: {} as Client,
		transport: Promise.resolve(undefined),
	};

	test("should retrieve client state from tools/call cache", () => {
		// Arrange
		const method = "tools/call";
		const key = `test-key-${Date.now()}`;
		setRequestCache(method, key, mockClientState);

		// Act
		const result = getRequestCache(method, key);

		// Assert
		expect(result).toEqual(mockClientState as ClientState);
	});

	test("should retrieve client state from prompts/get cache", () => {
		// Arrange
		const method = "prompts/get";
		const key = `test-key-${Date.now()}`;
		setRequestCache(method, key, mockClientState);

		// Act
		const result = getRequestCache(method, key);

		// Assert
		expect(result).toEqual(mockClientState as ClientState);
	});

	test("should retrieve client state from resources/read cache", () => {
		// Arrange
		const method = "resources/read";
		const key = `test-key-${Date.now()}`;
		setRequestCache(method, key, mockClientState);

		// Act
		const result = getRequestCache(method, key);

		// Assert
		expect(result).toEqual(mockClientState as ClientState);
	});

	test("should retrieve client state set with mapped method name", () => {
		// Arrange
		const listMethod = "tools/list";
		const callMethod = "tools/call";
		const key = `test-key-${Date.now()}`;
		setRequestCache(listMethod, key, mockClientState);

		// Act
		const result = getRequestCache(callMethod, key);

		// Assert
		expect(result).toEqual(mockClientState as ClientState);
	});

	test("should throw error when client is not found", () => {
		// Arrange
		const method = "tools/call";
		const key = `nonexistent-key-${Date.now()}`;

		// Act & Assert
		expect(() => getRequestCache(method, key)).toThrow(
			`Client not found for ${method}:${key}`,
		);
	});
});
