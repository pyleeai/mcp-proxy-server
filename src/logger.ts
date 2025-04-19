import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const logPath = process.env.LOG_PATH;

const log = (level: string, ...messages: unknown[]) => {
	const timestamp = new Date().toISOString();
	const output = messages
		.map((message) => {
			if (message === undefined) return "undefined";
			if (typeof message === "string") return message;
			if (typeof message === "symbol") return message.toString();
			if (message instanceof Error) {
				return `${message.name}: ${message.message}${message.stack ? `\n${message.stack}` : ""}`;
			}
			try {
				return JSON.stringify(message);
			} catch {
				return "";
			}
		})
		.join(" ");
	const data = `${timestamp} [${level}] ${output}\n`;

	if (logPath) {
		mkdirSync(dirname(logPath), { recursive: true });
		appendFileSync(logPath, data, "utf8");
	}
};
const logger = {
	log,
	debug: log.bind(null, "DEBUG"),
	info: log.bind(null, "INFO"),
	warn: log.bind(null, "WARN"),
	error: log.bind(null, "ERROR"),
	[Symbol.dispose]: () => {},
};

export { logger };
