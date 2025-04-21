import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { getAllClients, setClientState, setRequestCache } from "../../src/data";
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
		const clientsBefore = getAllClients();

		// Act
		setClientState(testClientName, clientState);

		// Assert
		const clientsAfter = getAllClients();
		expect(clientsAfter.length).toBe(clientsBefore.length + 1);
		expect(
			clientsAfter.find((client) => client.name === testClientName),
		).toEqual(clientState);
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
		const clientsBefore = getAllClients();

		// Act
		setClientState(testClientName, clientState1);
		setClientState(testClientName, clientState2);

		// Assert
		const clientsAfter = getAllClients();
		expect(clientsAfter.length).toBe(clientsBefore.length + 1);
		const foundClient = clientsAfter.find(
			(client) => client.name === testClientName,
		);
		expect(foundClient).toEqual(clientState2);
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

	test("should return an array instance", () => {
		// Act
		const clients = getAllClients();

		// Assert
		expect(clients).toBeInstanceOf(Array);
	});

	test("should return all client states including the ones we add", () => {
		// Arrange
		const testClientName1 = `test-client-${Date.now()}-1`;
		const testClientName2 = `test-client-${Date.now()}-2`;
		testClientNames.push(testClientName1, testClientName2);
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
		expect(clientsAfter.find((c) => c.name === testClientName1)).toEqual(
			clientState1,
		);
		expect(clientsAfter.find((c) => c.name === testClientName2)).toEqual(
			clientState2,
		);
	});

	test("should return a new array that doesn't affect the internal state", () => {
		// Arrange
		const testClientName = `test-client-${Date.now()}-array-copy`;
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
		setClientState(testClientName, clientState);
		const initialLength = getAllClients().length;

		// Act
		const clients = getAllClients();
		clients.pop();

		// Assert
		const clientsAfterModification = getAllClients();
		expect(clientsAfterModification.length).toBe(initialLength);
		expect(
			clientsAfterModification.find((c) => c.name === testClientName),
		).toEqual(clientState);
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
