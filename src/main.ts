#!/usr/bin/env bun

import { exitWithError, handleSIGINT } from "./process";
import { proxy } from "./proxy";

export async function main() {
	await proxy();
}

main().catch(exitWithError);

process.on("SIGINT", handleSIGINT);
