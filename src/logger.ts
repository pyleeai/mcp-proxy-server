import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const convertUnknownToString = (unknown: unknown): string => {
	if (unknown === null) return "null";
	if (unknown === undefined) return "undefined";
	if (typeof unknown === "string") return unknown;
	if (typeof unknown === "symbol") return unknown.toString();
	if (typeof unknown === "function") return "{}";
	if (typeof unknown === "number") {
		if (Number.isNaN(unknown) || !Number.isFinite(unknown)) return "null";
		return String(unknown);
	}
	if (unknown instanceof Error)
		return `${unknown.name}: ${unknown.message}${unknown.stack ? `\n${unknown.stack}` : ""}`;
	if (unknown instanceof Map || unknown instanceof Set)
		return "[Complex Object]";
	try {
		return JSON.stringify(unknown);
	} catch {
		return "[Complex Object]";
	}
};

export const logMessage = (level: string, message: unknown): string => {
	const now = new Date();
	const timestamp = now.toISOString();
	const output = convertUnknownToString(message);
	return `${timestamp} [${level}] ${output}\n`;
};

export const logMessages = (level: string, messages: unknown[]): string => {
	return messages.map((message) => logMessage(level, message)).join(" ");
};

export const log = (level: string, ...messages: unknown[]): string => {
	const logPath = process.env.LOG_PATH;
	const data = logMessages(level, messages);

	if (logPath) {
		try {
			mkdirSync(dirname(logPath), { recursive: true });
			appendFileSync(logPath, data, "utf8");
		} catch (e) {
			console.error(`Failed to write to log file ${logPath}: ${e}`);
		}
	}

	return data;
};

export const debug = (...messages: unknown[]): string => {
	return log("DEBUG", ...messages);
};

export const info = (...messages: unknown[]): string => {
	return log("INFO", ...messages);
};

export const warn = (...messages: unknown[]): string => {
	return log("WARN", ...messages);
};

export const error = (...messages: unknown[]): string => {
	return log("ERROR", ...messages);
};

export const logger = {
	log,
	debug,
	info,
	warn,
	error,
	[Symbol.dispose]: () => {},
};
