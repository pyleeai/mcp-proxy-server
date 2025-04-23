import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
	getAllClientStates,
	getAllClients,
	getClientFor,
	setClientFor,
	setClientState,
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

describe("setClientFor", () => {
	test("should set the client in the proxy map for a given method and identifier", () => {
		// Arrange
		const method = "test-method";
		const identifier = "test-identifier";
		const mockClient = { identifier: "client1" } as unknown as Client;

		// Act
		setClientFor(method, identifier, mockClient);

		// Assert
		const retrievedClient = getClientFor(method, identifier);
		expect(retrievedClient).toBe(mockClient);
	});

	test("should overwrite an existing client for the same method and identifier", () => {
		// Arrange
		const method = "test-method-overwrite";
		const identifier = "test-identifier-overwrite";
		const mockClient1 = { identifier: "client1" } as unknown as Client;
		const mockClient2 = { identifier: "client2" } as unknown as Client;

		// Act
		setClientFor(method, identifier, mockClient1);
		setClientFor(method, identifier, mockClient2);

		// Assert
		const retrievedClient = getClientFor(method, identifier);
		expect(retrievedClient).toBe(mockClient2);
		expect(retrievedClient).not.toBe(mockClient1);
	});

	test("should handle multiple methods with different names", () => {
		// Arrange
		const method1 = "test-method-multi-1";
		const method2 = "test-method-multi-2";
		const name1 = "test-identifier-multi-1";
		const name2 = "test-identifier-multi-2";
		const mockClient1 = { identifier: "client1" } as unknown as Client;
		const mockClient2 = { identifier: "client2" } as unknown as Client;

		// Act
		setClientFor(method1, name1, mockClient1);
		setClientFor(method2, name2, mockClient2);

		// Assert
		const retrievedClient1 = getClientFor(method1, name1);
		const retrievedClient2 = getClientFor(method2, name2);
		expect(retrievedClient1).toBe(mockClient1);
		expect(retrievedClient2).toBe(mockClient2);
	});
});

describe("getClientFor", () => {
	test("should get the client from the proxy map for a given method and identifier", () => {
		// Arrange
		const method = "test-method-get";
		const identifier = "test-identifier-get";
		const mockClient = { identifier: "client1" } as unknown as Client;
		setClientFor(method, identifier, mockClient);

		// Act
		const result = getClientFor(method, identifier);

		// Assert
		expect(result).toBe(mockClient);
	});

	test("should throw an error when no clients are registered for a method", () => {
		// Arrange
		const method = `nonexistent-method-${Date.now()}`;
		const identifier = "test-identifier";

		// Act & Assert
		expect(() => getClientFor(method, identifier)).toThrow(
			`No clients registered for method ${method}`,
		);
	});

	test("should throw an error when client is not found for a method and identifier", () => {
		// Arrange
		const method = "test-method-not-found";
		const identifier = "test-identifier-exists";
		const nonExistentName = `nonexistent-identifier-${Date.now()}`;
		const mockClient = { identifier: "client1" } as unknown as Client;
		setClientFor(method, identifier, mockClient);

		// Act & Assert
		expect(() => getClientFor(method, nonExistentName)).toThrow(
			`Client not found for ${method}:${nonExistentName}`,
		);
	});
});
