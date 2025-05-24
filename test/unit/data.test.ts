import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
	clearAllClientStates,
	getAllClientStates,
	getAllClients,
	getClientFor,
	getClientVersion,
	getKeyFor,
	getReadMethodFor,
	removeClientMappings,
	removeClientState,
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
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
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
		const mockTransport1 = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const mockTransport2 = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
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
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;

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

describe("removeClientState", () => {
	let testClientNames: string[] = [];

	beforeEach(() => {
		testClientNames = [];
	});

	test("should remove a client state", () => {
		// Arrange
		const testClientName = `test-client-${Date.now()}-remove`;
		testClientNames.push(testClientName);
		const mockClient = { name: "client1" } as unknown as Client;
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const clientState: ClientState = {
			name: testClientName,
			client: mockClient,
			transport: mockTransport,
		};
		setClientState(testClientName, clientState);
		const clientsBefore = getAllClientStates();

		// Act
		removeClientState(testClientName);

		// Assert
		const clientsAfter = getAllClientStates();
		expect(clientsAfter.length).toBe(clientsBefore.length - 1);
		const found = clientsAfter.find((client) => client.name === testClientName);
		expect(found).toBeUndefined();
	});

	test("should handle removing non-existent client state", () => {
		// Arrange
		const nonExistentName = `non-existent-${Date.now()}`;
		const clientsBefore = getAllClientStates();

		// Act
		removeClientState(nonExistentName);

		// Assert
		const clientsAfter = getAllClientStates();
		expect(clientsAfter.length).toBe(clientsBefore.length);
	});

	afterEach(() => {
		const mockClient = { name: "cleanup" } as unknown as Client;
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;

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
		const mockTransport1 = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const mockTransport2 = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
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
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
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
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
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
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;

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

describe("getKeyFor", () => {
	test("should return 'prompts' for 'prompts/list' method", () => {
		// Arrange
		const method = "prompts/list";

		// Act
		const result = getKeyFor(method);

		// Assert
		expect(result).toBe("prompts");
	});

	test("should return 'tools' for 'tools/list' method", () => {
		// Arrange
		const method = "tools/list";

		// Act
		const result = getKeyFor(method);

		// Assert
		expect(result).toBe("tools");
	});

	test("should return 'resources' for 'resources/list' method", () => {
		// Arrange
		const method = "resources/list";

		// Act
		const result = getKeyFor(method);

		// Assert
		expect(result).toBe("resources");
	});

	test("should return 'resourceTemplates' for 'resources/templates/list' method", () => {
		// Arrange
		const method = "resources/templates/list";

		// Act
		const result = getKeyFor(method);

		// Assert
		expect(result).toBe("resourceTemplates");
	});

	test("should return the original method string for unrecognized methods", () => {
		// Arrange
		const method = "unknown/method";

		// Act
		const result = getKeyFor(method);

		// Assert
		expect(result).toBe(method);
	});
});

describe("getReadMethodFor", () => {
	test("should return 'prompts/get' for 'prompts/list' method", () => {
		// Arrange
		const method = "prompts/list";

		// Act
		const result = getReadMethodFor(method);

		// Assert
		expect(result).toBe("prompts/get");
	});

	test("should return 'tools/call' for 'tools/list' method", () => {
		// Arrange
		const method = "tools/list";

		// Act
		const result = getReadMethodFor(method);

		// Assert
		expect(result).toBe("tools/call");
	});

	test("should return 'resources/read' for 'resources/list' method", () => {
		// Arrange
		const method = "resources/list";

		// Act
		const result = getReadMethodFor(method);

		// Assert
		expect(result).toBe("resources/read");
	});

	test("should return the original method string for unrecognized methods", () => {
		// Arrange
		const method = "unknown/method";

		// Act
		const result = getReadMethodFor(method);

		// Assert
		expect(result).toBe(method);
	});
});

describe("clearAllClientStates", () => {
	test("should clear all client states and proxy mappings", () => {
		// Arrange
		const mockClient1 = { name: "client1" } as unknown as Client;
		const mockClient2 = { name: "client2" } as unknown as Client;
		const mockTransport1 = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const mockTransport2 = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const clientState1: ClientState = {
			name: "test-client-1",
			client: mockClient1,
			transport: mockTransport1,
		};
		const clientState2: ClientState = {
			name: "test-client-2",
			client: mockClient2,
			transport: mockTransport2,
		};

		setClientState("test-client-1", clientState1);
		setClientState("test-client-2", clientState2);
		setClientFor("test-method", "test-identifier-1", mockClient1);
		setClientFor("test-method", "test-identifier-2", mockClient2);

		// Verify data exists
		expect(getAllClientStates().length).toBeGreaterThan(0);

		// Act
		clearAllClientStates();

		// Assert
		expect(getAllClientStates().length).toBe(0);
		expect(getAllClients().length).toBe(0);
		expect(() => getClientFor("test-method", "test-identifier-1")).toThrow();
		expect(() => getClientFor("test-method", "test-identifier-2")).toThrow();
	});
});

describe("removeClientMappings", () => {
	test("should remove all mappings for a specific client", () => {
		// Arrange
		const mockClient1 = { name: "client1" } as unknown as Client;
		const mockClient2 = { name: "client2" } as unknown as Client;

		setClientFor("method1", "identifier1", mockClient1);
		setClientFor("method1", "identifier2", mockClient2);
		setClientFor("method2", "identifier3", mockClient1);
		setClientFor("method2", "identifier4", mockClient2);

		// Verify mappings exist
		expect(getClientFor("method1", "identifier1")).toBe(mockClient1);
		expect(getClientFor("method1", "identifier2")).toBe(mockClient2);
		expect(getClientFor("method2", "identifier3")).toBe(mockClient1);
		expect(getClientFor("method2", "identifier4")).toBe(mockClient2);

		// Act
		removeClientMappings(mockClient1);

		// Assert
		expect(() => getClientFor("method1", "identifier1")).toThrow();
		expect(getClientFor("method1", "identifier2")).toBe(mockClient2);
		expect(() => getClientFor("method2", "identifier3")).toThrow();
		expect(getClientFor("method2", "identifier4")).toBe(mockClient2);
	});

	test("should handle removing mappings for non-existent client", () => {
		// Arrange
		const mockClient1 = { name: "client1" } as unknown as Client;
		const mockClient2 = { name: "client2" } as unknown as Client;
		const nonExistentClient = { name: "non-existent" } as unknown as Client;

		setClientFor("method1", "identifier1", mockClient1);
		setClientFor("method1", "identifier2", mockClient2);

		// Act
		removeClientMappings(nonExistentClient);

		// Assert - original mappings should still exist
		expect(getClientFor("method1", "identifier1")).toBe(mockClient1);
		expect(getClientFor("method1", "identifier2")).toBe(mockClient2);
	});
});

describe("getClientVersion", () => {
	let testClientNames: string[] = [];

	beforeEach(() => {
		testClientNames = [];
	});

	test("should return empty version object when there is no infomation", () => {
		// Arrange
		const mockClient = {
			getServerVersion: () => undefined,
		} as unknown as Client;

		// Act
		const result = getClientVersion(mockClient);

		// Assert
		expect(result).toEqual({ name: "", version: "" });
	});

	test("should return version object with name when client.getServerVersion returns name", () => {
		// Arrange
		const versionObject = { name: "test-version", version: "1.0.0" };
		const mockClient = {
			getServerVersion: () => versionObject,
		} as unknown as Client;

		// Act
		const result = getClientVersion(mockClient);

		// Assert
		expect(result).toEqual(versionObject);
	});

	test("should find client in clientsStateMap when getServerVersion doesn't return name", () => {
		// Arrange
		const testClientName = `test-client-${Date.now()}-version`;
		testClientNames.push(testClientName);
		const versionObject = { version: "1.0.0" };
		const mockClient = {
			getServerVersion: () => versionObject,
		} as unknown as Client;
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const clientState: ClientState = {
			name: testClientName,
			client: mockClient,
			transport: mockTransport,
		};
		setClientState(testClientName, clientState);

		// Act
		const result = getClientVersion(mockClient);

		// Assert
		expect(result).toEqual({ name: testClientName, version: "1.0.0" });
	});

	afterEach(() => {
		const mockClient = { name: "cleanup" } as unknown as Client;
		const mockTransport = {
			close: () => {},
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;

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
