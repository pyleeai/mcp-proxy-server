await Bun.build({
	entrypoints: ["./src/index.ts", "./src/main.ts"],
	outdir: "./dist",
	target: "node",
});

export {};
