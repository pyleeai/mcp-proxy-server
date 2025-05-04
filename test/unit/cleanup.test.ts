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
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { cleanup } from "../../src/cleanup";
import * as dataModule from "../../src/data";
import { logger } from "../../src/logger";
import type { ClientState } from "../../src/types";

describe("cleanup", () => {
	let loggerInfoSpy: ReturnType<typeof spyOn>;
	let loggerDebugSpy: ReturnType<typeof spyOn>;
	let loggerErrorSpy: ReturnType<typeof spyOn>;
	let mockGetAllClientStates: ReturnType<typeof spyOn>;

	beforeEach(() => {
		mockGetAllClientStates = spyOn(dataModule, "getAllClientStates");
		loggerInfoSpy = spyOn(logger, "info");
		loggerDebugSpy = spyOn(logger, "debug");
		loggerErrorSpy = spyOn(logger, "error");
	});

	test("should close all client transports successfully", async () => {
		// Arrange
		const mockCloseTransport1 = mock(() => Promise.resolve());
		const mockCloseTransport2 = mock(() => Promise.resolve());
		const transport1: Transport = {
			close: mockCloseTransport1,
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const transport2: Transport = {
			close: mockCloseTransport2,
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const clientStates: ClientState[] = [
			{
				name: "client1",
				client: { name: "test-client-1" } as unknown as Client,
				transport: transport1,
			},
			{
				name: "client2",
				client: { name: "test-client-2" } as unknown as Client,
				transport: transport2,
			},
		];
		mockGetAllClientStates.mockImplementation(() => clientStates);

		// Act
		await cleanup();

		// Assert
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(loggerInfoSpy).toHaveBeenNthCalledWith(1, "Cleaning up 2 clients");
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Closing transport for client client1",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Closing transport for client client2",
		);
		expect(mockCloseTransport1).toHaveBeenCalledTimes(1);
		expect(mockCloseTransport2).toHaveBeenCalledTimes(1);
		expect(loggerErrorSpy).not.toHaveBeenCalled();
		expect(loggerInfoSpy).toHaveBeenNthCalledWith(2, "Cleaned up 2 clients");
	});

	test("should handle client without transport", async () => {
		// Arrange
		const clientStates: ClientState[] = [
			{
				name: "client-no-transport",
				client: { name: "test-client-no-transport" } as unknown as Client,
				transport: undefined,
			},
		];
		mockGetAllClientStates.mockImplementation(() => clientStates);

		// Act
		await cleanup();

		// Assert
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(loggerInfoSpy).toHaveBeenNthCalledWith(1, "Cleaning up 1 clients");
		expect(loggerInfoSpy).toHaveBeenNthCalledWith(2, "Cleaned up 1 clients");
		expect(loggerDebugSpy).not.toHaveBeenCalled();
		expect(loggerErrorSpy).not.toHaveBeenCalled();
	});

	test("should handle error when closing transport", async () => {
		// Arrange
		const mockError = new Error("Failed to close transport");
		const mockCloseTransport = mock(() => Promise.reject(mockError));
		const transport: Transport = {
			close: mockCloseTransport,
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;
		const clientStates: ClientState[] = [
			{
				name: "client-error",
				client: { name: "test-client-error" } as unknown as Client,
				transport: transport,
			},
		];
		mockGetAllClientStates.mockImplementation(() => clientStates);

		// Act
		await cleanup();

		// Assert
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(loggerInfoSpy).toHaveBeenNthCalledWith(1, "Cleaning up 1 clients");
		expect(loggerInfoSpy).toHaveBeenNthCalledWith(2, "Cleaned up 1 clients");
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Closing transport for client client-error",
		);
		expect(mockCloseTransport).toHaveBeenCalledTimes(1);
		expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
		expect(loggerErrorSpy).toHaveBeenCalledWith(
			"Error closing transport for client client-error",
			mockError,
		);
	});

	test("should handle mixed cases with some successful and some failing transports", async () => {
		// Arrange
		const mockCloseTransportSuccess = mock(() => Promise.resolve());
		const mockCloseError = new Error("Failed to close transport");
		const mockCloseTransportError = mock(() => Promise.reject(mockCloseError));

		// Create successful transport
		const transportSuccess: Transport = {
			close: mockCloseTransportSuccess,
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;

		// Create transport that will fail on close
		const transportError: Transport = {
			close: mockCloseTransportError,
			start: () => Promise.resolve(),
			send: () => Promise.resolve(),
		} as unknown as Transport;

		const clientStates: ClientState[] = [
			{
				name: "client-success",
				client: { name: "test-client-success" } as unknown as Client,
				transport: transportSuccess,
			},
			{
				name: "client-error",
				client: { name: "test-client-error" } as unknown as Client,
				transport: transportError,
			},
			{
				name: "client-no-transport",
				client: { name: "test-client-no-transport" } as unknown as Client,
				transport: undefined,
			},
		];
		mockGetAllClientStates.mockImplementation(() => clientStates);

		// Act
		await cleanup();

		// Assert
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(loggerInfoSpy).toHaveBeenNthCalledWith(1, "Cleaning up 3 clients");
		expect(loggerInfoSpy).toHaveBeenNthCalledWith(2, "Cleaned up 3 clients");
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Closing transport for client client-success",
		);
		expect(loggerDebugSpy).toHaveBeenCalledWith(
			"Closing transport for client client-error",
		);
		expect(mockCloseTransportSuccess).toHaveBeenCalledTimes(1);
		expect(mockCloseTransportError).toHaveBeenCalledTimes(1);
		expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
	});

	test("should handle empty client states array", async () => {
		// Arrange
		mockGetAllClientStates.mockImplementation(() => []);

		// Act
		await cleanup();

		// Assert
		expect(mockGetAllClientStates).toHaveBeenCalledTimes(1);
		expect(loggerInfoSpy).not.toHaveBeenCalled();
		expect(loggerDebugSpy).not.toHaveBeenCalled();
		expect(loggerErrorSpy).not.toHaveBeenCalled();
	});

	afterEach(() => {
		// Clean up after each test
		mockGetAllClientStates.mockRestore();
		loggerInfoSpy.mockRestore();
		loggerDebugSpy.mockRestore();
		loggerErrorSpy.mockRestore();
	});
});
