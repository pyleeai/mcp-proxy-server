import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { logger } from "./logger";

using log = logger;

export const sendResourceListChanged = async (
	server: Server,
): Promise<void> => {
	try {
		await server.sendResourceListChanged();
		log.debug("Sent resource list changed notification");
	} catch (error) {
		log.warn("Failed to send resource list changed notification", error);
	}
};

export const sendToolListChanged = async (server: Server): Promise<void> => {
	try {
		await server.sendToolListChanged();
		log.debug("Sent tool list changed notification");
	} catch (error) {
		log.warn("Failed to send tool list changed notification", error);
	}
};

export const sendPromptListChanged = async (server: Server): Promise<void> => {
	try {
		await server.sendPromptListChanged();
		log.debug("Sent prompt list changed notification");
	} catch (error) {
		log.warn("Failed to send prompt list changed notification", error);
	}
};

export const sendAllListChangedNotifications = async (
	server: Server,
): Promise<void> => {
	log.info("Sending list changed notifications to connected clients");

	await Promise.allSettled([
		sendResourceListChanged(server),
		sendToolListChanged(server),
		sendPromptListChanged(server),
	]);

	log.debug("Completed sending all list changed notifications");
};
